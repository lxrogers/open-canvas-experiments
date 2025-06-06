import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { ArtifactMarkdownV3, SuggestedChange } from "@opencanvas/shared/types";
import "@blocknote/core/fonts/inter.css";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/shadcn/style.css";
import { isArtifactMarkdownContent } from "@opencanvas/shared/utils/artifacts";
import { CopyText } from "./components/CopyText";
import { useGraphContext } from "@/contexts/GraphContext";
import React from "react";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeRaw from 'rehype-raw';

const cleanText = (text: string) => {
  return text.replaceAll("\\\\n", "\\n");
};

function ViewRawText({
  isRawView,
  setIsRawView,
}: {
  isRawView: boolean;
  setIsRawView: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <TooltipIconButton
        tooltip={`View ${isRawView ? "rendered" : "raw"} markdown`}
        variant="outline"
        delayDuration={400}
        onClick={() => setIsRawView((p) => !p)}
      >
        {isRawView ? (
          <EyeOff className="w-5 h-5 text-gray-600" />
        ) : (
          <Eye className="w-5 h-5 text-gray-600" />
        )}
      </TooltipIconButton>
    </motion.div>
  );
}

export interface TextRendererProps {
  isEditing: boolean;
  isHovering: boolean;
  isInputVisible: boolean;
  suggestedChanges?: SuggestedChange[];
  selectedSuggestionIndex?: number | null;
  onSuggestionHighlightClick?: (index: number) => void;
}

export function TextRendererComponent(props: TextRendererProps) {
  const editor = useCreateBlockNote({});
  const { graphData } = useGraphContext();
  const {
    artifact,
    isStreaming,
    updateRenderedArtifactRequired,
    firstTokenReceived,
    setArtifact,
    setSelectedBlocks,
    setUpdateRenderedArtifactRequired,
  } = graphData;

  const [rawMarkdown, setRawMarkdown] = useState("");
  const [isRawView, setIsRawView] = useState(false);
  const [manuallyUpdatingArtifact, setManuallyUpdatingArtifact] =
    useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [allHighlightBoxStyles, setAllHighlightBoxStyles] = useState<React.CSSProperties[]>([]);

  useEffect(() => {
    const selectedText = editor.getSelectedText();
    const selection = editor.getSelection();

    if (selectedText && selection && selection.blocks.length > 0) {
      if (!artifact) {
        console.error("Artifact not found");
        return;
      }

      const currentBlockIdx = artifact.currentIndex;
      const currentContent = artifact.contents.find(
        (c) => c.index === currentBlockIdx
      );
      if (!currentContent) {
        console.error("Current content not found");
        return;
      }
      if (!isArtifactMarkdownContent(currentContent)) {
        return;
      }

      (async () => {
        try {
          const [markdownBlock, fullMarkdown] = await Promise.all([
            editor.blocksToMarkdownLossy(selection.blocks),
            editor.blocksToMarkdownLossy(editor.document),
          ]);
          setSelectedBlocks({
            fullMarkdown: cleanText(fullMarkdown),
            markdownBlock: cleanText(markdownBlock),
            selectedText: cleanText(selectedText),
          });
        } catch (e) {
          console.error("Error processing selection to markdown:", e);
        }
      })();
    } else if (!selectedText && !editor.getSelectedText()) {
      setSelectedBlocks(undefined);
    }
  }, [editor.getSelectedText(), artifact, setSelectedBlocks, editor]);

  useEffect(() => {
    if (!props.isInputVisible) {
      setSelectedBlocks(undefined);
    }
  }, [props.isInputVisible, setSelectedBlocks]);

  useEffect(() => {
    if (!artifact) {
      editor.replaceBlocks(editor.document, []);
      if (updateRenderedArtifactRequired) setUpdateRenderedArtifactRequired(false);
      return;
    }

    const currentFocusedContent = artifact.contents.find(
      (c) => c.index === artifact.currentIndex && c.type === "text"
    ) as ArtifactMarkdownV3 | undefined;

    if (!currentFocusedContent) {
      editor.replaceBlocks(editor.document, []);
      if (updateRenderedArtifactRequired) setUpdateRenderedArtifactRequired(false);
      return;
    }
    const markdownToLoad = cleanText(currentFocusedContent.fullMarkdown);

    if (isStreaming || updateRenderedArtifactRequired) {
      (async () => {
        setManuallyUpdatingArtifact(true);
        try {
          const currentEditorMarkdown = await editor.blocksToMarkdownLossy(editor.document);
          if (cleanText(currentEditorMarkdown) !== markdownToLoad || updateRenderedArtifactRequired) {
            const markdownAsBlocks = await editor.tryParseMarkdownToBlocks(markdownToLoad);
            editor.replaceBlocks(editor.document, markdownAsBlocks);
          }
        } catch (e) {
          console.error("TextRenderer: Error updating editor from artifact stream/update:", e);
          try {
            const markdownAsBlocks = await editor.tryParseMarkdownToBlocks(markdownToLoad);
            editor.replaceBlocks(editor.document, markdownAsBlocks);
          } catch (finalE) { console.error("TextRenderer: Final fallback error during stream/update:", finalE); }
        } finally {
          setManuallyUpdatingArtifact(false);
          if (updateRenderedArtifactRequired) {
            setUpdateRenderedArtifactRequired(false);
          }
        }
      })();
    } else if (props.isEditing) {
      (async () => {
        setManuallyUpdatingArtifact(true); 
        try {
          const currentEditorMarkdown = await editor.blocksToMarkdownLossy(editor.document);
          if (cleanText(currentEditorMarkdown) !== markdownToLoad) {
            const markdownAsBlocks = await editor.tryParseMarkdownToBlocks(markdownToLoad);
            editor.replaceBlocks(editor.document, markdownAsBlocks);
          }
        } catch (e) {
          console.error("TextRenderer: Error reloading editor in editing mode:", e);
          try {
            const markdownAsBlocks = await editor.tryParseMarkdownToBlocks(markdownToLoad);
            editor.replaceBlocks(editor.document, markdownAsBlocks);
          } catch (finalE) { console.error("TextRenderer: Final fallback error in editing mode sync:", finalE); }
        } finally {
          setManuallyUpdatingArtifact(false);
        }
      })();
    } else if (!props.isEditing && !isRawView) {
      if (!manuallyUpdatingArtifact) {
        (async () => {
          try {
            const currentEditorMarkdown = await editor.blocksToMarkdownLossy(editor.document);
            if (cleanText(currentEditorMarkdown) !== markdownToLoad) {
              const markdownAsBlocks = await editor.tryParseMarkdownToBlocks(markdownToLoad);
              editor.replaceBlocks(editor.document, markdownAsBlocks);
            }
          } catch (e) { /* console.error("TextRenderer: Error syncing non-visible editor", e) */ }
        })();
      }
    }

    if (updateRenderedArtifactRequired) {
        setUpdateRenderedArtifactRequired(false);
    }

  }, [
    artifact,
    isStreaming,
    updateRenderedArtifactRequired,
    props.isEditing, 
    editor,
    setUpdateRenderedArtifactRequired,
    isRawView 
  ]);

  useEffect(() => {
    if (isRawView) {
      editor.blocksToMarkdownLossy(editor.document).then(md => setRawMarkdown(cleanText(md)));
    } else if (!isRawView && rawMarkdown && artifact) {
      const currentFocusedContent = artifact.contents.find(
        (c) => c.index === artifact.currentIndex && c.type === "text"
      ) as ArtifactMarkdownV3 | undefined;

      if (currentFocusedContent && cleanText(rawMarkdown) !== cleanText(currentFocusedContent.fullMarkdown)) {
        try {
          (async () => {
            setManuallyUpdatingArtifact(true);
            const markdownAsBlocks =
              await editor.tryParseMarkdownToBlocks(rawMarkdown);
            editor.replaceBlocks(editor.document, markdownAsBlocks);
            setArtifact((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                contents: prev.contents.map((c) =>
                  c.index === prev.currentIndex && isArtifactMarkdownContent(c)
                    ? { ...c, fullMarkdown: rawMarkdown }
                    : c
                ),
              };
            });
            setManuallyUpdatingArtifact(false);
          })();
        } catch (_) {
          console.error("Error parsing markdown from raw view to update editor", _);
          setManuallyUpdatingArtifact(false);
        }
      }
    }
  }, [isRawView, rawMarkdown, editor, artifact, setArtifact]);

  const isComposition = useRef(false);

  const onChange = async () => {
    if (
      isStreaming ||
      manuallyUpdatingArtifact ||
      updateRenderedArtifactRequired ||
      isComposition.current
    )
      return;

    const fullMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    const cleanedMarkdown = cleanText(fullMarkdown);

    setArtifact((prev) => {
      if (!prev) {
        console.warn("Attempted to update non-existent artifact from TextRenderer onChange");
        return {
          currentIndex: 1,
          contents: [
            { index: 1, fullMarkdown: cleanedMarkdown, title: "Untitled", type: "text" },
          ],
        };
      }
      
      const currentContent = prev.contents.find(c => c.index === prev.currentIndex);
      if (currentContent && isArtifactMarkdownContent(currentContent) && cleanText(currentContent.fullMarkdown) === cleanedMarkdown) {
        return prev;
      }

      return {
        ...prev,
        contents: prev.contents.map((c) => {
          if (c.index === prev.currentIndex) {
            if (isArtifactMarkdownContent(c)) {
              return { ...c, fullMarkdown: cleanedMarkdown };
            }
            return { index: c.index, fullMarkdown: cleanedMarkdown, title: c.title || "Untitled", type: "text" };
          }
          return c;
        }),
      };
    });
  };

  const onChangeRawMarkdown = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newRawMarkdownValue = e.target.value;
    setRawMarkdown(newRawMarkdownValue);
  };
  
  const artifactTextContentForDisplay = (() => {
    if (!artifact) return "";
    const currentContent = artifact.contents.find(c => c.index === artifact.currentIndex);
    if (isArtifactMarkdownContent(currentContent)) {
      return currentContent.fullMarkdown;
    }
    return "";
  })();

  const processContentWithSuggestions = (text: string, suggestions: SuggestedChange[] = []) => {
    let processedText = text;

    const sortedSuggestions = [...suggestions].sort((a, b) => {
      const posA = text.indexOf(a.prevText);
      const posB = text.indexOf(b.prevText);
      if (posA === -1 && posB === -1) return 0;
      if (posA === -1) return 1;
      if (posB === -1) return -1;
      return posA - posB;
    });

    for (let i = sortedSuggestions.length - 1; i >= 0; i--) {
      const suggestion = sortedSuggestions[i];
      const originalGlobalIndex = props.suggestedChanges?.findIndex(s => s === suggestion) ?? -1;

      if (originalGlobalIndex === -1) continue;

      const prevTextId = `suggestion-prev-${originalGlobalIndex}`;
      let replacement = "";

      replacement = `<span class="text-black line-through decoration-blue-500 decoration-2" data-prevtext-id="${prevTextId}">${suggestion.prevText}</span>` +
                    `<span class="text-blue-700 ml-1">${suggestion.suggestedText}</span>`;
      
      const indexInProcessed = processedText.indexOf(suggestion.prevText);
      if (indexInProcessed !== -1) {
        processedText = processedText.substring(0, indexInProcessed) + 
                         replacement + 
                         processedText.substring(indexInProcessed + suggestion.prevText.length);
      }
    }
    return processedText;
  };
  
  const processedContent = processContentWithSuggestions(artifactTextContentForDisplay, props.suggestedChanges);

  useEffect(() => {
    if (props.isEditing || isRawView || !containerRef.current || !props.suggestedChanges || props.suggestedChanges.length === 0) {
      setAllHighlightBoxStyles([]);
      return;
    }

    const container = containerRef.current;
    const newStyles: React.CSSProperties[] = [];

    props.suggestedChanges.forEach((_suggestion, index) => {
      const prevTextElement = container.querySelector(`[data-prevtext-id="suggestion-prev-${index}"]`) as HTMLElement;
      if (prevTextElement && prevTextElement.nextElementSibling) {
        const suggestedTextElement = prevTextElement.nextElementSibling as HTMLElement;
        const containerRect = container.getBoundingClientRect();
        const prevRect = prevTextElement.getBoundingClientRect();
        const suggestedRect = suggestedTextElement.getBoundingClientRect();
        const actualTop = Math.min(prevRect.top, suggestedRect.top);
        const actualLeft = Math.min(prevRect.left, suggestedRect.left);
        const top = actualTop - containerRect.top + container.scrollTop;
        const left = actualLeft - containerRect.left + container.scrollLeft;
        const rightMostPoint = Math.max(prevRect.right, suggestedRect.right);
        const width = rightMostPoint - actualLeft;
        const bottomMostPoint = Math.max(prevRect.bottom, suggestedRect.bottom);
        const height = bottomMostPoint - actualTop;
        newStyles[index] = {
          position: "absolute",
          top: `${top - 20}px`,
          left: `${left - 2}px`,
          width: `${width + 4}px`,
          height: `${height + 4}px`,
          border: index === props.selectedSuggestionIndex ? "2px solid #3B82F6" : "2px solid transparent",
          borderRadius: "4px",
          pointerEvents: "auto",
          cursor: "pointer",
          zIndex: 1,
        };
      } else {
        newStyles[index] = {};
      }
    });
    setAllHighlightBoxStyles(newStyles);

  }, [props.suggestedChanges, processedContent, props.isEditing, isRawView, props.selectedSuggestionIndex, containerRef.current]);

  const contentObjectForCopyText = artifact?.contents.find(c => c.index === artifact.currentIndex);
  
  const blockNoteEditable = props.isEditing && !isStreaming && !manuallyUpdatingArtifact;

  return (
    <div ref={containerRef} className="w-full h-full mt-2 flex flex-col border-t-[1px] border-gray-200 overflow-y-auto py-5 relative">
      {props.isHovering && artifact && (
        <div className="absolute flex gap-2 top-2 right-4 z-10" style={{ paddingTop: '12px', paddingRight: '12px'}}>
          <CopyText currentArtifactContent={contentObjectForCopyText} />
          <ViewRawText isRawView={isRawView} setIsRawView={setIsRawView} />
        </div>
      )}

      {isRawView ? (
        <Textarea
          className="whitespace-pre-wrap font-mono text-sm px-[54px] py-5 border-0 shadow-none h-full outline-none ring-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 font-light leading-relaxed"
          value={rawMarkdown}
          onChange={onChangeRawMarkdown}
          disabled={!props.isEditing || isStreaming}
        />
      ) : props.isEditing ? (
        <>
          <style jsx global>{`
            .pulse-text .bn-block-group {
              animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
            @keyframes pulse {
              0%,
              100% {
                opacity: 1;
              }
              50% {
                opacity: 0.3;
              }
            }
            .bn-editor-override .bn-editor {
              padding-left: 24px;
              padding-right: 54px;
              padding-top: 20px;
              padding-bottom: 20px;
            }
            .bn-editor-override .bn-editor .bn-block-content {
              line-height: 1.6;
              font-weight: normal;
            }
          `}</style>
          <BlockNoteView
            theme="light"
            formattingToolbar={false}
            slashMenu={false}
            onCompositionStartCapture={() => (isComposition.current = true)}
            onCompositionEndCapture={() => {
              isComposition.current = false;
              onChange();
            }}
            onChange={onChange}
            editable={blockNoteEditable}
            editor={editor}
            className={cn(
              isStreaming && !firstTokenReceived ? "pulse-text" : "",
              "custom-blocknote-theme flex-grow"
            )}
          >
            <SuggestionMenuController
              getItems={async (query) =>
                getDefaultReactSlashMenuItems(editor).filter(
                  (z) => z.group !== "Media" && (z.title.toLowerCase().includes(query.toLowerCase()) || z.aliases?.some(a => a.toLowerCase().includes(query.toLowerCase())))
                )
              }
              triggerCharacter={"/"}
            />
          </BlockNoteView>
        </>
      ) : (
        <div className="prose prose-sm max-w-none p-4 py-5 px-[54px] relative font-mono font-light leading-relaxed">
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
            {processedContent}
          </ReactMarkdown>
          {!props.isEditing && !isRawView && allHighlightBoxStyles.map((style, index) => (
            (Object.keys(style).length > 0 && props.onSuggestionHighlightClick) && (
              <div 
                key={`highlight-${index}`}
                style={style} 
                onClick={() => props.onSuggestionHighlightClick && props.onSuggestionHighlightClick(index)}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

export const TextRenderer = React.memo(TextRendererComponent);
