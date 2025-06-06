import { useGraphContext } from "@/contexts/GraphContext";
import { useToast } from "@/hooks/use-toast";
import { ProgrammingLanguageOptions } from "@opencanvas/shared/types";
import { ThreadPrimitive } from "@assistant-ui/react";
import { Thread as ThreadType } from "@langchain/langgraph-sdk";
import { ArrowDownIcon, PanelRightOpen, SquarePen } from "lucide-react";
import { Dispatch, FC, SetStateAction, useState } from "react";
import { ReflectionsDialog } from "../reflections-dialog/ReflectionsDialog";
import { useLangSmithLinkToolUI } from "../tool-hooks/LangSmithLinkToolUI";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { TighterText } from "../ui/header";
import { Composer } from "./composer";
import { AssistantMessage, UserMessage } from "./messages";
import ModelSelector from "./model-selector";
import { ThreadHistory } from "./thread-history";
import { ThreadWelcome } from "./welcome";
import { useUserContext } from "@/contexts/UserContext";
import { useThreadContext } from "@/contexts/ThreadProvider";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { Button } from "@/components/ui/button";
import { getNextMessage, convertToLangChainMessage, VoiceMessage } from "@/lib/test-voice-messages";
import { BaseMessage } from "@langchain/core/messages";
import { convertToOpenAIFormat } from "@/lib/convert_messages";
import { GraphInput } from "@opencanvas/shared/types";

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-8 rounded-full disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

export interface ThreadProps {
  userId: string | undefined;
  hasChatStarted: boolean;
  handleQuickStart: (
    type: "text" | "code" | "board",
    language?: ProgrammingLanguageOptions,
    options?: {
      sessionMode?: 'writingAssistant' | 'general' | string;
      initialSystemPrompt?: string;
      initialUserMessage?: string;
    }
  ) => void;
  setChatStarted: Dispatch<SetStateAction<boolean>>;
  switchSelectedThreadCallback: (thread: ThreadType) => void;
  searchEnabled: boolean;
  setChatCollapsed: (c: boolean) => void;
}

export const Thread: FC<ThreadProps> = (props: ThreadProps) => {
  const {
    setChatStarted,
    hasChatStarted,
    handleQuickStart,
    switchSelectedThreadCallback,
  } = props;
  const { toast } = useToast();
  const {
    graphData: { clearState, runId, feedbackSubmitted, setFeedbackSubmitted, messages, setMessages, streamMessage, artifact, runNoteTaker },
  } = useGraphContext();
  const { selectedAssistant } = useAssistantContext();
  const {
    modelName,
    setModelName,
    modelConfig,
    setModelConfig,
    modelConfigs,
    setThreadId,
    threadId,
    createThread,
  } = useThreadContext();
  const { user } = useUserContext();

  // State for tracking the current test message index
  const [currentTestMessageIndex, setCurrentTestMessageIndex] = useState(-1);

  // Render the LangSmith trace link
  useLangSmithLinkToolUI();

  const handleNewSession = async () => {
    if (!user) {
      toast({
        title: "User not found",
        description: "Failed to create thread without user",
        duration: 5000,
        variant: "destructive",
      });
      return;
    }

    // Remove the threadId param from the URL
    setThreadId(null);

    setModelName(modelName);
    setModelConfig(modelName, modelConfig);
    clearState();
    setChatStarted(false);
    setCurrentTestMessageIndex(-1); // Reset test message index on new session
  };

  const handleAddTestMessage = async () => {
    const nextMessageFromFile = getNextMessage(currentTestMessageIndex);
    if (nextMessageFromFile) {
      const langChainFormattedMessage = convertToLangChainMessage(nextMessageFromFile);
      
      console.log("Adding test message (no streaming):", langChainFormattedMessage);
      console.log("Current threadId:", threadId, "hasChatStarted:", hasChatStarted);

      // Create a thread if one doesn't exist yet
      if (!threadId) {
        console.log("Creating thread for test messages...");
        const newThread = await createThread();
        if (!newThread) {
          toast({
            title: "Error",
            description: "Failed to create thread for test messages",
            variant: "destructive",
            duration: 5000,
          });
          return;
        }
        console.log("Thread created:", newThread.thread_id);
      }

      if (setMessages) { 
        // Update messages first
        setMessages((prevMessages: BaseMessage[]) => [...prevMessages, langChainFormattedMessage]);
        
        // Only run the NoteTaker agent if this is a human message
        if (nextMessageFromFile.speaker === "user") {
          // Run the NoteTaker agent with the current messages plus the new one
          // This happens outside the state setter to avoid multiple calls
          const currentMessagesWithNew = [...messages, langChainFormattedMessage];
          runNoteTaker(currentMessagesWithNew, artifact).catch((error) => {
            console.error("Failed to run NoteTaker agent:", error);
          });
        } else {
          console.log("Skipping NoteTaker for AI message");
        }
        
        if (!hasChatStarted) {
          setChatStarted(true);
        }
      } else {
        console.error("setMessages function is not available from GraphContext.");
        return;
      }
      
      setCurrentTestMessageIndex(prevIndex => prevIndex + 1);
    } else {
      console.log("No more test messages available.");
      // Optionally reset the index if you want to loop or stop
      // setCurrentTestMessageIndex(-1); 
    }
  };

  return (
    <ThreadPrimitive.Root className="flex flex-col h-full w-full">
      <div className="pr-3 pl-6 pt-3 pb-2 flex flex-row gap-4 items-center justify-between">
        <div className="flex items-center justify-start gap-2 text-gray-600">
          <ThreadHistory
            switchSelectedThreadCallback={switchSelectedThreadCallback}
          />
          <TighterText className="text-xl">Open Canvas</TighterText>
          {!hasChatStarted && (
            <ModelSelector
              modelName={modelName}
              setModelName={setModelName}
              modelConfig={modelConfig}
              setModelConfig={setModelConfig}
              modelConfigs={modelConfigs}
            />
          )}
        </div>
        {hasChatStarted ? (
          <div className="flex flex-row flex-1 gap-2 items-center justify-end">
            <TooltipIconButton
              tooltip="Collapse Chat"
              variant="ghost"
              className="w-8 h-8"
              delayDuration={400}
              onClick={() => props.setChatCollapsed(true)}
            >
              <PanelRightOpen className="text-gray-600" />
            </TooltipIconButton>
            <TooltipIconButton
              tooltip="New chat"
              variant="ghost"
              className="w-8 h-8"
              delayDuration={400}
              onClick={handleNewSession}
            >
              <SquarePen className="text-gray-600" />
            </TooltipIconButton>
          </div>
        ) : (
          <div className="flex flex-row gap-2 items-center">
            <ReflectionsDialog selectedAssistant={selectedAssistant} />
          </div>
        )}
      </div>
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scroll-smooth bg-inherit px-4 pt-8">
        {!hasChatStarted && (
          <ThreadWelcome
            handleQuickStart={handleQuickStart}
            composer={
              <Composer
                chatStarted={false}
                userId={props.userId}
                searchEnabled={props.searchEnabled}
              />
            }
            searchEnabled={props.searchEnabled}
          />
        )}
        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessage,
            AssistantMessage: (prop) => (
              <AssistantMessage
                {...prop}
                feedbackSubmitted={feedbackSubmitted}
                setFeedbackSubmitted={setFeedbackSubmitted}
                runId={runId}
              />
            ),
          }}
        />
      </ThreadPrimitive.Viewport>
      <div className="mt-4 flex w-full flex-col items-center justify-end rounded-t-lg bg-inherit pb-4 px-4">
        <ThreadScrollToBottom />
        <div className="w-full max-w-2xl">
          {hasChatStarted && (
            <div className="flex flex-col space-y-2">
              <ModelSelector
                modelName={modelName}
                setModelName={setModelName}
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
                modelConfigs={modelConfigs}
              />
              <Composer
                chatStarted={true}
                userId={props.userId}
                searchEnabled={props.searchEnabled}
              />
              <div className="mt-2 flex justify-center">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleAddTestMessage}
                >
                  Add Test Messages (Dev)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
};
