import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  getArtifactContent,
  isArtifactCodeContent,
  isArtifactMarkdownContent,
} from "@opencanvas/shared/utils/artifacts";
import {
  Reflections,
} from "@opencanvas/shared/types";
import {
  createContextDocumentMessages,
  ensureStoreInConfig,
  formatReflections,
  getModelFromConfig,
} from "../../utils.js";
import { SUGGEST_CHANGES_PROMPT } from "../prompts.js";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";

/**
 * Suggest changes to an existing artifact based on the user's query.
 */
export const suggestChanges = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const smallModel = await getModelFromConfig(config, {
    temperature: 0,
  });

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections)
    : "No reflections found.";

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }

  // Get the content based on artifact type
  let content = "";
  if (isArtifactCodeContent(currentArtifactContent)) {
    content = currentArtifactContent.code;
  } else if (isArtifactMarkdownContent(currentArtifactContent)) {
    content = currentArtifactContent.fullMarkdown;
  } else {
    content = currentArtifactContent.board;
  }

  const formattedPrompt = SUGGEST_CHANGES_PROMPT
    .replace("{artifactContent}", content)
    .replace("{reflections}", memoriesAsString);

  const recentHumanMessage = state._messages.findLast(
    (message) => message.getType() === "human"
  );
  if (!recentHumanMessage) {
    throw new Error("No recent human message found");
  }

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const suggestions = await smallModel.invoke([
    { role: "system", content: formattedPrompt },
    ...contextDocumentMessages,
    recentHumanMessage,
  ]);

  // Return the suggestions as a new message
  return {
    messages: [suggestions],
  };
}; 