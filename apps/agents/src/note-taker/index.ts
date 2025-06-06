import { ChatAnthropic } from "@langchain/anthropic";
import {
  type LangGraphRunnableConfig,
  StateGraph,
  START,
} from "@langchain/langgraph";
import {
  NoteTakerGraphAnnotation,
  NoteTakerGraphReturnType,
} from "./state.js";
import { NOTE_TAKER_SYSTEM_PROMPT, NOTE_TAKER_USER_PROMPT } from "./prompts.js";
import { z } from "zod";
import { ensureStoreInConfig } from "../utils.js";
import {
  getArtifactContent,
  getArtifactContentText,
} from "@opencanvas/shared/utils/artifacts";

export const takeNotes = async (
  state: typeof NoteTakerGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<NoteTakerGraphReturnType> => {
  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.open_canvas_assistant_id;
  const threadId = config.configurable?.thread_id;
  
  if (!assistantId) {
    throw new Error("`open_canvas_assistant_id` not found in configurable");
  }
  if (!threadId) {
    throw new Error("`thread_id` not found in configurable");
  }

  // Retrieve existing notes from the store - now thread-specific
  const notesNamespace = ["notes", assistantId, threadId];
  const notesKey = "ghostwriter_notes";
  const existingNotes = await store.get(notesNamespace, notesKey);
  
  const existingNotesData = existingNotes?.value as {
    goalsNotes: string[];
    styleNotes: string[];
    ideasNotes: string[];
    structureNotes: string[];
  } | null;

  const takeNotesTool = {
    name: "take_notes",
    description: "Generate structured notes about the user's writing project from the ghostwriter conversation.",
    schema: z.object({
      goalsNotes: z
        .array(z.string())
        .describe("Notes about what the user is trying to accomplish with their document - purpose, audience, objectives, desired outcomes."),
      styleNotes: z
        .array(z.string())
        .describe("Notes about the tone, style, length, format, and voice preferences for the document."),
      ideasNotes: z
        .array(z.string())
        .describe("Notes about the content and substance - key topics, themes, specific ideas, examples, research."),
      structureNotes: z
        .array(z.string())
        .describe("Notes about document organization - outline, sections, flow, transitions, narrative structure."),
    }),
  };

  const model = new ChatAnthropic({
    model: "claude-3-5-sonnet-20240620",
    temperature: 0.1,
  }).bindTools([takeNotesTool], {
    tool_choice: "take_notes",
  });

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  const artifactContent = getArtifactContentText(currentArtifactContent);

  // Format existing notes for the prompt
  let existingNotesString = "No existing notes found.";
  if (existingNotesData) {
    existingNotesString = "Existing notes from previous conversations:\n\n";
    if (existingNotesData.goalsNotes && existingNotesData.goalsNotes.length > 0) {
      existingNotesString += "# Goals\n" + existingNotesData.goalsNotes.map((g: string) => `- ${g}`).join("\n") + "\n\n";
    }
    if (existingNotesData.styleNotes && existingNotesData.styleNotes.length > 0) {
      existingNotesString += "# Style Notes\n" + existingNotesData.styleNotes.map((s: string) => `- ${s}`).join("\n") + "\n\n";
    }
    if (existingNotesData.ideasNotes && existingNotesData.ideasNotes.length > 0) {
      existingNotesString += "# Ideas\n" + existingNotesData.ideasNotes.map((i: string) => `- ${i}`).join("\n") + "\n\n";
    }
    if (existingNotesData.structureNotes && existingNotesData.structureNotes.length > 0) {
      existingNotesString += "# Structure\n" + existingNotesData.structureNotes.map((s: string) => `- ${s}`).join("\n") + "\n\n";
    }
  }

  const formattedUserPrompt = NOTE_TAKER_USER_PROMPT
    .replace(
      "{messages}",
      state.messages
        .map((msg) => `<${msg.getType()}>\n${msg.content}\n</${msg.getType()}>`)
        .join("\n\n")
    )
    .replace("{artifact}", artifactContent ?? "No artifact context")
    .replace("{existing_notes}", existingNotesString);

  const result = await model.invoke([
    {
      role: "system",
      content: NOTE_TAKER_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: formattedUserPrompt,
    },
  ]);

  const noteTakingToolCall = result.tool_calls?.[0];
  if (!noteTakingToolCall) {
    console.error("FAILED TO GENERATE NOTE TAKING TOOL CALL", result);
    throw new Error("Note taking tool call failed.");
  }

  const goalsNotes = noteTakingToolCall.args.goalsNotes || [];
  const styleNotes = noteTakingToolCall.args.styleNotes || [];
  const ideasNotes = noteTakingToolCall.args.ideasNotes || [];
  const structureNotes = noteTakingToolCall.args.structureNotes || [];

  // Merge with existing notes
  const mergedGoalsNotes: string[] = existingNotesData?.goalsNotes ? [...existingNotesData.goalsNotes, ...goalsNotes] : goalsNotes;
  const mergedStyleNotes: string[] = existingNotesData?.styleNotes ? [...existingNotesData.styleNotes, ...styleNotes] : styleNotes;
  const mergedIdeasNotes: string[] = existingNotesData?.ideasNotes ? [...existingNotesData.ideasNotes, ...ideasNotes] : ideasNotes;
  const mergedStructureNotes: string[] = existingNotesData?.structureNotes ? [...existingNotesData.structureNotes, ...structureNotes] : structureNotes;
  
  // Remove duplicates (simple deduplication based on exact string match)
  const uniqueGoalsNotes: string[] = [...new Set(mergedGoalsNotes)];
  const uniqueStyleNotes: string[] = [...new Set(mergedStyleNotes)];
  const uniqueIdeasNotes: string[] = [...new Set(mergedIdeasNotes)];
  const uniqueStructureNotes: string[] = [...new Set(mergedStructureNotes)];
  
  const updatedNotesData = {
    goalsNotes: uniqueGoalsNotes,
    styleNotes: uniqueStyleNotes,
    ideasNotes: uniqueIdeasNotes,
    structureNotes: uniqueStructureNotes,
    timestamp: new Date().toISOString(),
    messageCount: state.messages.length,
  };

  console.log("NoteTaker: Storing notes with namespace:", notesNamespace, "key:", notesKey);
  await store.put(notesNamespace, notesKey, updatedNotesData);

  console.log("NoteTaker: Updated notes for ghostwriter session:", {
    assistantId,
    threadId,
    newGoals: goalsNotes.length,
    newStyleNotes: styleNotes.length,
    newIdeas: ideasNotes.length,
    newStructure: structureNotes.length,
    totalGoals: uniqueGoalsNotes.length,
    totalStyleNotes: uniqueStyleNotes.length,
    totalIdeas: uniqueIdeasNotes.length,
    totalStructure: uniqueStructureNotes.length,
  });

  // Return all accumulated notes organized by category
  return {
    notes: {
      goalsNotes: uniqueGoalsNotes,
      styleNotes: uniqueStyleNotes,
      ideasNotes: uniqueIdeasNotes,
      structureNotes: uniqueStructureNotes,
    },
    storedSuccessfully: true,
  };
};

const builder = new StateGraph(NoteTakerGraphAnnotation)
  .addNode("takeNotes", takeNotes)
  .addEdge(START, "takeNotes");

export const graph = builder.compile().withConfig({ runName: "note-taker" }); 