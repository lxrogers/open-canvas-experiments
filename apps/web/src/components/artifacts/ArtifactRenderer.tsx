import { convertToOpenAIFormat } from "@/lib/convert_messages";
import { cn } from "@/lib/utils";
import {
  ArtifactCodeV3,
  ArtifactMarkdownV3,
  ProgrammingLanguageOptions,
  ArtifactBoardV3,
} from "@opencanvas/shared/types";
import { EditorView } from "@codemirror/view";
import { HumanMessage } from "@langchain/core/messages";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ActionsToolbar, CodeToolBar } from "./actions_toolbar";
import { CodeRenderer } from "./CodeRenderer";
import { TextRenderer } from "./TextRenderer";
import { BoardRenderer, OnNoteUpdate } from "./BoardRenderer";
import { CustomQuickActions } from "./actions_toolbar/custom";
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import { ArtifactLoading } from "./ArtifactLoading";
import { AskOpenCanvas } from "./components/AskOpenCanvas";
import { useGraphContext } from "@/contexts/GraphContext";
import { ArtifactHeader } from "./header";
import { useUserContext } from "@/contexts/UserContext";
import { useAssistantContext } from "@/contexts/AssistantContext";

export interface ArtifactRendererProps {
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  chatCollapsed: boolean;
  setChatCollapsed: (c: boolean) => void;
}

interface SelectionBox {
  top: number;
  left: number;
  text: string;
}

function ArtifactRendererComponent(props: ArtifactRendererProps) {
  const { graphData } = useGraphContext();
  const { selectedAssistant } = useAssistantContext();
  const { user } = useUserContext();
  const {
    artifact,
    selectedBlocks,
    isStreaming,
    isArtifactSaved,
    artifactUpdateFailed,
    setSelectedArtifact,
    setArtifact,
    setMessages,
    streamMessage,
    setSelectedBlocks,
  } = graphData;
  const editorRef = useRef<EditorView | null>(null);
  const artifactContentRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox>();
  const [selectionIndexes, setSelectionIndexes] = useState<{
    start: number;
    end: number;
  }>();
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isHoveringOverArtifact, setIsHoveringOverArtifact] = useState(false);
  const [isValidSelectionOrigin, setIsValidSelectionOrigin] = useState(false);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentRef.current) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();

      // Check if the selection originated from within the artifact content
      if (selectedText && artifactContentRef.current) {
        const isWithinArtifact = (node: Node | null): boolean => {
          if (!node) return false;
          if (node === artifactContentRef.current) return true;
          return isWithinArtifact(node.parentNode);
        };

        // Check both start and end containers
        const startInArtifact = isWithinArtifact(range.startContainer);
        const endInArtifact = isWithinArtifact(range.endContainer);

        if (startInArtifact && endInArtifact) {
          setIsValidSelectionOrigin(true);
          const rects = range.getClientRects();
          const firstRect = rects[0];
          const lastRect = rects[rects.length - 1];
          const contentRect = contentRef.current.getBoundingClientRect();

          const boxWidth = 400; // Approximate width of the selection box
          let left = lastRect.right - contentRect.left - boxWidth;

          if (left < 0) {
            left = Math.min(0, firstRect.left - contentRect.left);
          }
          // Ensure the box doesn't go beyond the left edge
          if (left < 0) {
            left = Math.min(0, firstRect.left - contentRect.left);
          }

          setSelectionBox({
            top: lastRect.bottom - contentRect.top,
            left: left,
            text: selectedText,
          });
          setIsInputVisible(false);
          setIsSelectionActive(true);
        } else {
          setIsValidSelectionOrigin(false);
          handleCleanupState();
        }
      }
    }
  }, []);

  const handleCleanupState = () => {
    setIsInputVisible(false);
    setSelectionBox(undefined);
    setSelectionIndexes(undefined);
    setIsSelectionActive(false);
    setIsValidSelectionOrigin(false);
    setInputValue("");
  };

  const handleDocumentMouseDown = useCallback(
    (event: MouseEvent) => {
      if (
        isSelectionActive &&
        selectionBoxRef.current &&
        !selectionBoxRef.current.contains(event.target as Node)
      ) {
        handleCleanupState();
      }
    },
    [isSelectionActive]
  );

  const handleSelectionBoxMouseDown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const handleSubmit = async (content: string) => {
    const humanMessage = new HumanMessage({
      content,
      id: uuidv4(),
    });

    setMessages((prevMessages) => [...prevMessages, humanMessage]);
    handleCleanupState();
    await streamMessage({
      messages: [convertToOpenAIFormat(humanMessage)],
      ...(selectionIndexes && {
        highlightedCode: {
          startCharIndex: selectionIndexes.start,
          endCharIndex: selectionIndexes.end,
        },
      }),
    });
  };

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [handleMouseUp, handleDocumentMouseDown]);

  useEffect(() => {
    try {
      if (artifactContentRef.current && highlightLayerRef.current) {
        const content = artifactContentRef.current;
        const highlightLayer = highlightLayerRef.current;

        // Clear existing highlights
        highlightLayer.innerHTML = "";

        if (isSelectionActive && selectionBox) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            if (content.contains(range.commonAncestorContainer)) {
              const rects = range.getClientRects();
              const layerRect = highlightLayer.getBoundingClientRect();

              // Calculate start and end indexes
              let startIndex = 0;
              let endIndex = 0;
              let currentArtifactContent:
                | ArtifactCodeV3
                | ArtifactMarkdownV3
                | ArtifactBoardV3
                | undefined = undefined;
              try {
                currentArtifactContent = artifact
                  ? getArtifactContent(artifact)
                  : undefined;
              } catch (_) {
                console.error(
                  "[ArtifactRenderer.tsx L229]\n\nERROR NO ARTIFACT CONTENT FOUND\n\n",
                  artifact
                );
                // no-op
              }

              if (currentArtifactContent?.type === "code") {
                if (editorRef.current) {
                  const from = editorRef.current.posAtDOM(
                    range.startContainer,
                    range.startOffset
                  );
                  const to = editorRef.current.posAtDOM(
                    range.endContainer,
                    range.endOffset
                  );
                  startIndex = from;
                  endIndex = to;
                }
                setSelectionIndexes({ start: startIndex, end: endIndex });
              }

              for (let i = 0; i < rects.length; i++) {
                const rect = rects[i];
                const highlightEl = document.createElement("div");
                highlightEl.className =
                  "absolute bg-[#3597934d] pointer-events-none";

                // Adjust the positioning and size
                const verticalPadding = 3;
                highlightEl.style.left = `${rect.left - layerRect.left}px`;
                highlightEl.style.top = `${rect.top - layerRect.top - verticalPadding}px`;
                highlightEl.style.width = `${rect.width}px`;
                highlightEl.style.height = `${rect.height + verticalPadding * 2}px`;

                highlightLayer.appendChild(highlightEl);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to get artifact selection", e);
    }
  }, [isSelectionActive, selectionBox]);

  useEffect(() => {
    if (!!selectedBlocks && !isSelectionActive) {
      // Selection is not active but selected blocks are present. Clear them.
      setSelectedBlocks(undefined);
    }
  }, [selectedBlocks, isSelectionActive]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if we're in an input/textarea element
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      // If selection states are active and we're not in an input field
      if (
        (isInputVisible || selectionBox || isSelectionActive) &&
        !isInputActive
      ) {
        // Check if the key is a character key or backspace/delete
        if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
          handleCleanupState();
        }
      }

      // Handle escape key for input box
      if ((isInputVisible || isSelectionActive) && e.key === "Escape") {
        handleCleanupState();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isInputVisible, selectionBox, isSelectionActive]);

  const currentArtifactContent = artifact
    ? (getArtifactContent(artifact) as
        | ArtifactMarkdownV3
        | ArtifactCodeV3
        | ArtifactBoardV3
        | undefined)
    : undefined;

  // --- Handler for updating board notes --- 
  const handleBoardNoteUpdate: OnNoteUpdate = useCallback(
    (updatedIndex, updatedNoteData) => {
      if (!artifact || !currentArtifactContent || currentArtifactContent.type !== 'board') {
        console.error("Cannot update note: Invalid artifact state.");
        return;
      }

      try {
        // 1. Parse existing NDJSON
        const lines = currentArtifactContent.board.trim().split('\n');
        const notes = lines.map(line => JSON.parse(line));
        
        // 2. Update the specific note
        if (updatedIndex >= 0 && updatedIndex < notes.length) {
          notes[updatedIndex] = { 
            ...notes[updatedIndex], 
            x: updatedNoteData.x, 
            y: updatedNoteData.y 
          };
        } else {
           console.error(`Invalid index ${updatedIndex} provided for note update.`);
           return;
        }

        // 3. Re-serialize to NDJSON
        const updatedBoardString = notes.map(note => JSON.stringify(note)).join('\n');

        // 4. Update artifact state
        const updatedBoardContent: ArtifactBoardV3 = {
          ...currentArtifactContent,
          board: updatedBoardString,
        };

        // Create new contents array with the updated board content
        const newContents = artifact.contents.map(content => 
          content.index === currentArtifactContent.index ? updatedBoardContent : content
        );

        // Set the new artifact state
        setArtifact({
          ...artifact,
          contents: newContents,
          // Keep currentIndex the same, as we are just updating content
        });

      } catch (error) {
        console.error("Failed to update board note:", error);
      }
    },
    [artifact, currentArtifactContent, setArtifact] // Dependencies
  );

  // --- Debug Logging Start ---
  console.log("[ArtifactRenderer] Received artifact:", artifact);
  console.log(
    "[ArtifactRenderer] Determined currentArtifactContent:",
    currentArtifactContent
  );
  // --- Debug Logging End ---

  if (!artifact && isStreaming) {
    return <ArtifactLoading />;
  }

  if (!artifact || !currentArtifactContent) {
    return <div className="w-full h-full"></div>;
  }

  const isBackwardsDisabled =
    artifact.contents.length === 1 ||
    currentArtifactContent.index === 1 ||
    isStreaming;
  const isForwardDisabled =
    artifact.contents.length === 1 ||
    currentArtifactContent.index === artifact.contents.length ||
    isStreaming;

  return (
    <div className="relative w-full h-full max-h-screen overflow-auto">
      <ArtifactHeader
        isArtifactSaved={isArtifactSaved}
        isBackwardsDisabled={isBackwardsDisabled}
        isForwardDisabled={isForwardDisabled}
        setSelectedArtifact={setSelectedArtifact}
        currentArtifactContent={currentArtifactContent}
        totalArtifactVersions={artifact.contents.length}
        selectedAssistant={selectedAssistant}
        artifactUpdateFailed={artifactUpdateFailed}
        chatCollapsed={props.chatCollapsed}
        setChatCollapsed={props.setChatCollapsed}
      />
      <div
        ref={contentRef}
        className={cn(
          "flex justify-center h-full",
          currentArtifactContent.type === "code" ? "pt-[10px]" : ""
        )}
      >
        <div
          className={cn(
            "relative min-h-full",
            currentArtifactContent.type === "code" ? "min-w-full" : "min-w-full"
          )}
        >
          <div
            className="h-full"
            ref={artifactContentRef}
            onMouseEnter={() => setIsHoveringOverArtifact(true)}
            onMouseLeave={() => setIsHoveringOverArtifact(false)}
          >
            {currentArtifactContent.type === "text" ? (
              <TextRenderer
                isInputVisible={isInputVisible}
                isEditing={props.isEditing}
                isHovering={isHoveringOverArtifact}
              />
            ) : null}
            {currentArtifactContent.type === "code" ? (
              <CodeRenderer
                editorRef={editorRef}
                isHovering={isHoveringOverArtifact}
              />
            ) : null}
            {currentArtifactContent.type === "board" ? (
              <BoardRenderer 
                boardContent={currentArtifactContent.board} 
                onNoteUpdate={handleBoardNoteUpdate}
                isStreaming={isStreaming}
              />
            ) : null}
          </div>
          <div
            ref={highlightLayerRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
          />
        </div>
        {selectionBox && isSelectionActive && isValidSelectionOrigin && (
          <AskOpenCanvas
            ref={selectionBoxRef}
            inputValue={inputValue}
            setInputValue={setInputValue}
            isInputVisible={isInputVisible}
            selectionBox={selectionBox}
            setIsInputVisible={setIsInputVisible}
            handleSubmitMessage={handleSubmit}
            handleSelectionBoxMouseDown={handleSelectionBoxMouseDown}
            artifact={artifact}
            selectionIndexes={selectionIndexes}
            handleCleanupState={handleCleanupState}
          />
        )}
      </div>
      <CustomQuickActions
        streamMessage={streamMessage}
        assistantId={selectedAssistant?.assistant_id}
        user={user}
        isTextSelected={isSelectionActive || selectedBlocks !== undefined}
      />
      {currentArtifactContent.type === "text" ? (
        <ActionsToolbar
          streamMessage={streamMessage}
          isTextSelected={isSelectionActive || selectedBlocks !== undefined}
        />
      ) : null}
      {currentArtifactContent.type === "code" ? (
        <CodeToolBar
          streamMessage={streamMessage}
          isTextSelected={isSelectionActive || selectedBlocks !== undefined}
          language={
            (currentArtifactContent as ArtifactCodeV3).language as ProgrammingLanguageOptions
          }
        />
      ) : null}
      {currentArtifactContent.type === "board" ? null : null}
    </div>
  );
}

export const ArtifactRenderer = React.memo(ArtifactRendererComponent);
