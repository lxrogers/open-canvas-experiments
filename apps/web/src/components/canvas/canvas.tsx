"use client";

import { ArtifactRenderer } from "@/components/artifacts/ArtifactRenderer";
import { WebSearchResults } from "@/components/web-search-results";
import {
  ALL_MODEL_NAMES,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_MODEL_NAME,
} from "@opencanvas/shared/models";
import { useGraphContext } from "@/contexts/GraphContext";
import { useToast } from "@/hooks/use-toast";
import { getLanguageTemplate } from "@/lib/get_language_template";
import {
  ArtifactCodeV3,
  ArtifactMarkdownV3,
  ArtifactV3,
  CustomModelConfig,
  ProgrammingLanguageOptions,
  ArtifactBoardV3,
} from "@opencanvas/shared/types";
import React, { useEffect, useState } from "react";
import { ContentComposerChatInterface } from "./content-composer";
import NoSSRWrapper from "../NoSSRWrapper";
import { useThreadContext } from "@/contexts/ThreadProvider";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { CHAT_COLLAPSED_QUERY_PARAM } from "@/constants";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { HumanMessage } from "@langchain/core/messages";

export function CanvasComponent() {
  const { graphData } = useGraphContext();
  const { setModelName, setModelConfig } = useThreadContext();
  const { setArtifact, chatStarted, setChatStarted, setMessages, streamMessage } = graphData;
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [webSearchResultsOpen, setWebSearchResultsOpen] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const chatCollapsedSearchParam = searchParams.get(CHAT_COLLAPSED_QUERY_PARAM);
  useEffect(() => {
    try {
      if (chatCollapsedSearchParam) {
        setChatCollapsed(JSON.parse(chatCollapsedSearchParam));
      }
    } catch (e) {
      setChatCollapsed(false);
      const queryParams = new URLSearchParams(searchParams.toString());
      queryParams.delete(CHAT_COLLAPSED_QUERY_PARAM);
      router.replace(`?${queryParams.toString()}`, { scroll: false });
    }
  }, [chatCollapsedSearchParam]);

  const handleQuickStart = (
    type: "text" | "code" | "board",
    language?: ProgrammingLanguageOptions,
    options?: {
      sessionMode?: 'writingAssistant' | 'general' | string;
      initialSystemPrompt?: string;
      initialUserMessage?: string;
    }
  ) => {
    if (type === "code" && !language) {
      toast({
        title: "Language not selected",
        description: "Please select a language to continue",
        duration: 5000,
      });
      return;
    }
    setChatStarted(true);

    let artifactContent: ArtifactCodeV3 | ArtifactMarkdownV3 | ArtifactBoardV3;
    if (type === "code" && language) {
      artifactContent = {
        index: 1,
        type: "code",
        title: `Quick start ${type}`,
        code: getLanguageTemplate(language),
        language,
      };
    } else if (type === "board") {
      artifactContent = {
        index: 1,
        type: "board",
        title: `Quick start ${type}`,
        board: "",
      };
    } else {
      artifactContent = {
        index: 1,
        type: "text",
        title: `Quick start ${type}`,
        fullMarkdown: "",
      };
    }

    const newArtifact: ArtifactV3 = {
      currentIndex: 1,
      contents: [artifactContent],
      sessionMode: options?.sessionMode || 'general',
      isNew: true,
      lastSaved: null,
    };

    if (options?.sessionMode === 'writingAssistant') {
      console.log("Writing Assistant mode selected. Ensure correct system prompt is used for the new thread.");
    }

    if (options?.initialUserMessage) {
      const firstMessage = new HumanMessage({
        content: options.initialUserMessage,
        id: uuidv4(),
      });
      console.log("Initial user message for quick start:", options.initialUserMessage);
      if (setMessages && streamMessage) {
        setMessages((prevMessages: any) => [...prevMessages, firstMessage]);
        streamMessage({ messages: [{ role: 'user', content: options.initialUserMessage }] });
      } else {
        console.warn("setMessages or streamMessage not available in handleQuickStart scope");
      }
    }
    
    setArtifact(newArtifact);
    setIsEditing(true);
  };

  return (
    <ResizablePanelGroup direction="horizontal" className="h-screen">
      {!chatStarted && (
        <NoSSRWrapper>
          <ContentComposerChatInterface
            chatCollapsed={chatCollapsed}
            setChatCollapsed={(c) => {
              setChatCollapsed(c);
              const queryParams = new URLSearchParams(searchParams.toString());
              queryParams.set(CHAT_COLLAPSED_QUERY_PARAM, JSON.stringify(c));
              router.replace(`?${queryParams.toString()}`, { scroll: false });
            }}
            switchSelectedThreadCallback={(thread) => {
              // Chat should only be "started" if there are messages present
              if ((thread.values as Record<string, any>)?.messages?.length) {
                setChatStarted(true);
                if (thread?.metadata?.customModelName) {
                  setModelName(
                    thread.metadata.customModelName as ALL_MODEL_NAMES
                  );
                } else {
                  setModelName(DEFAULT_MODEL_NAME);
                }

                if (thread?.metadata?.modelConfig) {
                  setModelConfig(
                    (thread?.metadata?.customModelName ??
                      DEFAULT_MODEL_NAME) as ALL_MODEL_NAMES,
                    (thread.metadata?.modelConfig ??
                      DEFAULT_MODEL_CONFIG) as CustomModelConfig
                  );
                } else {
                  setModelConfig(DEFAULT_MODEL_NAME, DEFAULT_MODEL_CONFIG);
                }
              } else {
                setChatStarted(false);
              }
            }}
            setChatStarted={setChatStarted}
            hasChatStarted={chatStarted}
            handleQuickStart={handleQuickStart}
          />
        </NoSSRWrapper>
      )}
      {!chatCollapsed && chatStarted && (
        <ResizablePanel
          defaultSize={25}
          minSize={15}
          maxSize={50}
          className="transition-all duration-700 h-screen mr-auto bg-gray-50/70 shadow-inner-right"
          id="chat-panel-main"
          order={1}
        >
          <NoSSRWrapper>
            <ContentComposerChatInterface
              chatCollapsed={chatCollapsed}
              setChatCollapsed={(c) => {
                setChatCollapsed(c);
                const queryParams = new URLSearchParams(
                  searchParams.toString()
                );
                queryParams.set(CHAT_COLLAPSED_QUERY_PARAM, JSON.stringify(c));
                router.replace(`?${queryParams.toString()}`, { scroll: false });
              }}
              switchSelectedThreadCallback={(thread) => {
                // Chat should only be "started" if there are messages present
                if ((thread.values as Record<string, any>)?.messages?.length) {
                  setChatStarted(true);
                  if (thread?.metadata?.customModelName) {
                    setModelName(
                      thread.metadata.customModelName as ALL_MODEL_NAMES
                    );
                  } else {
                    setModelName(DEFAULT_MODEL_NAME);
                  }

                  if (thread?.metadata?.modelConfig) {
                    setModelConfig(
                      (thread?.metadata.customModelName ??
                        DEFAULT_MODEL_NAME) as ALL_MODEL_NAMES,
                      (thread.metadata.modelConfig ??
                        DEFAULT_MODEL_CONFIG) as CustomModelConfig
                    );
                  } else {
                    setModelConfig(DEFAULT_MODEL_NAME, DEFAULT_MODEL_CONFIG);
                  }
                } else {
                  setChatStarted(false);
                }
              }}
              setChatStarted={setChatStarted}
              hasChatStarted={chatStarted}
              handleQuickStart={handleQuickStart}
            />
          </NoSSRWrapper>
        </ResizablePanel>
      )}

      {chatStarted && (
        <>
          <ResizableHandle />
          <ResizablePanel
            defaultSize={chatCollapsed ? 100 : 75}
            maxSize={85}
            minSize={50}
            id="canvas-panel"
            order={2}
            className="flex flex-row w-full"
          >
            <div className="w-full ml-auto">
              <ArtifactRenderer
                chatCollapsed={chatCollapsed}
                setChatCollapsed={(c) => {
                  setChatCollapsed(c);
                  const queryParams = new URLSearchParams(
                    searchParams.toString()
                  );
                  queryParams.set(
                    CHAT_COLLAPSED_QUERY_PARAM,
                    JSON.stringify(c)
                  );
                  router.replace(`?${queryParams.toString()}`, {
                    scroll: false,
                  });
                }}
                setIsEditing={setIsEditing}
                isEditing={isEditing}
              />
            </div>
            <WebSearchResults
              open={webSearchResultsOpen}
              setOpen={setWebSearchResultsOpen}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}

export const Canvas = React.memo(CanvasComponent);
