import { convertToOpenAIFormat } from "@/lib/convert_messages";
import { cn } from "@/lib/utils";
import {
  ArtifactCodeV3,
  ArtifactMarkdownV3,
  ProgrammingLanguageOptions,
  ArtifactBoardV3,
  SuggestedChange,
  GraphInput,
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
import { motion, AnimatePresence } from "framer-motion";

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

const CARD_SPACING = 12; // Spacing between cards (increased from 6, previously 20)
const CARD_BASE_HEIGHT_ESTIMATE = 70; // Estimate for unselected card height (p-3, h3, etc.)
const CARD_DETAILS_HEIGHT_ESTIMATE = 200; // Estimate for expanded details
const EXTRA_PADDING_FOR_MEASURED_CARD = 12; // Extra padding to add to a card's height once measured

interface SuggestionCardProps {
  suggestion: SuggestedChange;
  originalIndex: number;
  isSelected: boolean;
  onSelectSuggestion: (index: number | null) => void;
  yPosition: number;
  cardRef: React.RefObject<HTMLDivElement>;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  originalIndex,
  isSelected,
  onSelectSuggestion,
  yPosition,
  cardRef,
}) => {
  return (
    <motion.div
      ref={cardRef}
      key={originalIndex}
      layout // handles smooth transition if size changes
      data-suggestion-card-index={originalIndex}
      initial={{ opacity: 0, y: yPosition + 20 }}
      animate={{
        opacity: 1,
        y: yPosition,
        position: "absolute",
        left: "1rem", // Corresponds to p-4 on parent
        right: "1rem",
        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }, // Custom cubic-bezier for snappier ease-out
      }}
      exit={{ opacity: 0, y: yPosition - 20, transition: {duration: 0.15, ease: [0.16, 1, 0.3, 1]} }}
      onClick={() => onSelectSuggestion(isSelected ? null : originalIndex)}
      className={cn(
        "rounded-lg p-3 border cursor-pointer w-[calc(100%-2rem)]", // Width takes parent padding into account
        isSelected
          ? "bg-white/80 backdrop-blur-sm shadow-lg border-gray-200 z-10 hover:bg-white/90"
          : "bg-slate-100 hover:bg-slate-200 border-slate-300 z-0"
      )}
    >
      <h3 className="font-medium text-gray-900 mb-1 text-sm truncate flex items-center gap-1.5">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          className="w-5 h-5 text-blue-500 flex-shrink-0"
          style={{ minWidth: '20px' }}
        >
          <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
          <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
        </svg>
        {suggestion.description}
      </h3>
      <AnimatePresence initial={false}>
        {isSelected && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.1, ease: [0.16, 1, 0.3, 1] } }}
            className="overflow-hidden mt-2"
          >
            <div className="space-y-2 pt-1">
              <div>
                <p className="text-xs text-gray-500 mb-1">Previous:</p>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all text-gray-500">
                  {suggestion.prevText}
                </pre>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Suggested:</p>
                <pre className="bg-blue-50 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap break-all text-blue-700">
                  {suggestion.suggestedText}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SuggestionCards: React.FC<{
  suggestions: SuggestedChange[] | undefined;
  selectedSuggestionIndex: number | null;
  onSelectSuggestion: (index: number | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  cardYPositions: number[];
  cardRefs: React.RefObject<HTMLDivElement>[];
}> = ({ suggestions, selectedSuggestionIndex, onSelectSuggestion, containerRef, cardYPositions, cardRefs }) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto p-4 relative" // relative for absolute children, p-4 for padding
    >
      <AnimatePresence>
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={index}
            suggestion={suggestion}
            originalIndex={index}
            isSelected={index === selectedSuggestionIndex}
            onSelectSuggestion={onSelectSuggestion}
            yPosition={cardYPositions[index] === undefined ? index * (CARD_BASE_HEIGHT_ESTIMATE + CARD_SPACING) : cardYPositions[index]} // Fallback if not calculated yet
            cardRef={cardRefs[index]}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

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
    shouldSuggestChanges,
    setShouldSuggestChanges,
  } = graphData;
  const editorRef = useRef<EditorView | null>(null);
  const artifactContentRef = useRef<HTMLDivElement>(null); 
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null); 
  const selectionBoxRef = useRef<HTMLDivElement>(null);
  const suggestionCardsContainerRef = useRef<HTMLDivElement>(null); 

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
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);
  const [cardYPositions, setCardYPositions] = useState<number[]>([]);
  const cardRefs = useRef<React.RefObject<HTMLDivElement>[]>([]); 

  const [showSuggestionsView, setShowSuggestionsView] = useState(false);

  const currentArtifactContent = artifact
  ? (getArtifactContent(artifact) as
      | ArtifactMarkdownV3
      | ArtifactCodeV3
      | ArtifactBoardV3
      | undefined)
  : undefined;

  useEffect(() => {
    const numSuggestions = currentArtifactContent?.suggestedChanges?.length || 0;
    cardRefs.current = Array(numSuggestions).fill(null).map((_, i) => cardRefs.current[i] || React.createRef<HTMLDivElement>());
    // Initialize positions when suggestions change to avoid undefined yPosition on first render of new cards
    if (numSuggestions > 0 && cardYPositions.length !== numSuggestions) {
      setCardYPositions(Array(numSuggestions).fill(0).map((_, i) => i * (CARD_BASE_HEIGHT_ESTIMATE + CARD_SPACING)));
    }
  }, [currentArtifactContent?.suggestedChanges, cardYPositions.length]);

  // Update showSuggestionsView based on presence of suggestions
  useEffect(() => {
    if (currentArtifactContent?.suggestedChanges && currentArtifactContent.suggestedChanges.length > 0) {
      setShowSuggestionsView(true);
    } else {
      setShowSuggestionsView(false);
    }
  }, [currentArtifactContent?.suggestedChanges]);

  // Function to toggle the suggestions view/panel
  const handleToggleSuggestionsView = () => {
    setShowSuggestionsView(prev => !prev);
    if (showSuggestionsView) { // If it was true and is now becoming false (closing panel)
        setSelectedSuggestionIndex(null); // Also deselect any active suggestion
    }
    // If opening and suggestions exist, TextRenderer will become read-only due to isEditing prop change.
    // If closing, TextRenderer will use props.isEditing.
  };

  // Function to apply a suggestion
  const handleApplySuggestion = useCallback((suggestionToApply: SuggestedChange) => {
    if (!artifact || !currentArtifactContent || currentArtifactContent.type !== 'text') {
      return;
    }

    const textContent = currentArtifactContent as ArtifactMarkdownV3;
    const currentMarkdown = textContent.fullMarkdown;

    // Replace only the first occurrence of prevText.
    // This assumes prevText is unique enough for the first match to be the correct one.
    const newMarkdown = currentMarkdown.replace(
      suggestionToApply.prevText,
      `~~${suggestionToApply.prevText}~~ ${suggestionToApply.suggestedText}`
    );

    if (newMarkdown === currentMarkdown) {
      console.warn("Suggestion application did not change markdown. prevText not found or identical after styling?", suggestionToApply.prevText);
      // Proceed to update suggestedChanges even if markdown didn't change, to remove the suggestion
    }

    setArtifact(prevArtifact => {
      if (!prevArtifact) return prevArtifact;
      return {
        ...prevArtifact,
        contents: prevArtifact.contents.map(content => {
          if (content.index === currentArtifactContent.index && content.type === 'text') {
            return {
              ...content,
              fullMarkdown: newMarkdown,
              suggestedChanges: content.suggestedChanges?.filter(
                s => s.prevText !== suggestionToApply.prevText || s.suggestedText !== suggestionToApply.suggestedText
              ),
            };
          }
          return content;
        }),
      };
    });
    props.setIsEditing(true); // Ensure editor is active to see the change
    setSelectedSuggestionIndex(null); // Deselect after applying
  }, [artifact, currentArtifactContent, setArtifact, props.setIsEditing]);

  const handleSelectSuggestion = useCallback((index: number | null) => {
    if (index !== null && index === selectedSuggestionIndex) { // Clicked an already selected card
      const suggestionToApply = currentArtifactContent?.suggestedChanges?.[index];
      if (suggestionToApply) {
        handleApplySuggestion(suggestionToApply);
      }
      // setSelectedSuggestionIndex(null); // Already handled in handleApplySuggestion
    } else {
      setSelectedSuggestionIndex(index);
    }
  }, [selectedSuggestionIndex, currentArtifactContent, handleApplySuggestion]);

  useEffect(() => {
    if (!artifactContentRef.current || !suggestionCardsContainerRef.current || !currentArtifactContent?.suggestedChanges) {
      setCardYPositions([]);
      return;
    }

    const calculateLayout = () => {
      const suggestions = currentArtifactContent.suggestedChanges || [];
      if (suggestions.length === 0) {
        setCardYPositions([]);
        return;
      }

      const finalPositionsMap = new Map<number, number>();
      const cardData: { index: number; yDesired: number; height: number }[] = [];

      // 1. Calculate initial desired Y and get current/estimated heights for all cards
      const sidebarScrollContainerRect = suggestionCardsContainerRef.current!.getBoundingClientRect();
      
      suggestions.forEach((_, index) => {
        let desiredY = index * (CARD_BASE_HEIGHT_ESTIMATE + CARD_SPACING); // Default initial stacking
        const prevTextElement = artifactContentRef.current!.querySelector(
          `[data-prevtext-id="suggestion-prev-${index}"]`
        ) as HTMLElement | null;

        if (prevTextElement) {
          const prevTextRect = prevTextElement.getBoundingClientRect();
          desiredY = prevTextRect.top - sidebarScrollContainerRect.top + suggestionCardsContainerRef.current!.scrollTop - 10; // Offset by 10px up
        }
        
        const cardElement = cardRefs.current[index]?.current;
        const currentHeight = 
          cardElement?.offsetHeight 
            ? cardElement.offsetHeight + EXTRA_PADDING_FOR_MEASURED_CARD // Add extra padding to measured height
            : (index === selectedSuggestionIndex 
                ? CARD_BASE_HEIGHT_ESTIMATE + CARD_DETAILS_HEIGHT_ESTIMATE 
                : CARD_BASE_HEIGHT_ESTIMATE);
        cardData.push({ index, yDesired: desiredY, height: currentHeight });
      });

      // 2. Prioritize selected card
      if (selectedSuggestionIndex !== null) {
        const selectedCardInfo = cardData.find(c => c.index === selectedSuggestionIndex);
        if (selectedCardInfo) {
          finalPositionsMap.set(selectedCardInfo.index, selectedCardInfo.yDesired);

          // Place cards ABOVE the selected card
          let lastPlacedYAbove = selectedCardInfo.yDesired;
          const cardsToPlaceAbove = cardData
            .filter(c => c.index !== selectedSuggestionIndex && c.yDesired < selectedCardInfo.yDesired)
            .sort((a, b) => b.yDesired - a.yDesired); // Sort descending by Y (closest to selected first)

          for (const card of cardsToPlaceAbove) {
            const targetY = lastPlacedYAbove - card.height - CARD_SPACING;
            // card.yDesired is used as a preference, but constrained by not overlapping
            const finalY = Math.min(card.yDesired, targetY);
            finalPositionsMap.set(card.index, finalY);
            lastPlacedYAbove = finalY; 
          }

          // Place cards BELOW the selected card
          let lastPlacedYBelow = selectedCardInfo.yDesired + selectedCardInfo.height + CARD_SPACING;
          const cardsToPlaceBelow = cardData
            .filter(c => c.index !== selectedSuggestionIndex && c.yDesired >= selectedCardInfo.yDesired)
            .sort((a, b) => a.yDesired - b.yDesired); // Sort ascending by Y (closest to selected first)

          for (const card of cardsToPlaceBelow) {
            // card.yDesired is used as a preference, but constrained by not overlapping
            const finalY = Math.max(card.yDesired, lastPlacedYBelow);
            finalPositionsMap.set(card.index, finalY);
            lastPlacedYBelow = finalY + card.height + CARD_SPACING;
          }
        }
      } else {
        // No card selected: Original stacking algorithm (sorted by desired Y)
        cardData.sort((a, b) => a.yDesired - b.yDesired);
        let accumulatedY = 0;
        for (let i = 0; i < cardData.length; i++) {
          const cardInfo = cardData[i];
          let currentCardY = Math.max(cardInfo.yDesired, accumulatedY);
          finalPositionsMap.set(cardInfo.index, currentCardY);
          accumulatedY = currentCardY + cardInfo.height + CARD_SPACING;
        }
      }
      
      const newYPositions = suggestions.map((_, index) => finalPositionsMap.get(index) || 0);
      setCardYPositions(newYPositions);
    };
    
    const timerId = setTimeout(calculateLayout, 100); // Increased delay for more complex calc + DOM updates
    
    const mainContentEl = artifactContentRef.current;
    mainContentEl?.addEventListener('scroll', calculateLayout);

    return () => {
        clearTimeout(timerId);
        mainContentEl?.removeEventListener('scroll', calculateLayout);
    }

  }, [selectedSuggestionIndex, currentArtifactContent?.suggestedChanges, artifactContentRef.current?.scrollTop]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentRef.current) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString().trim();

      if (selectedText && artifactContentRef.current) {
        const isWithinArtifact = (node: Node | null): boolean => {
          if (!node) return false;
          if (node === artifactContentRef.current) return true;
          return isWithinArtifact(node.parentNode);
        };

        const startInArtifact = isWithinArtifact(range.startContainer);
        const endInArtifact = isWithinArtifact(range.endContainer);

        if (startInArtifact && endInArtifact) {
          setIsValidSelectionOrigin(true);
          const rects = range.getClientRects();
          const firstRect = rects[0];
          const lastRect = rects[rects.length - 1];
          const mainContentRect = contentRef.current.getBoundingClientRect();

          const boxWidth = 400;
          let left = lastRect.right - mainContentRect.left - boxWidth;

          if (left < 0) {
            left = Math.min(0, firstRect.left - mainContentRect.left);
          }
          if (left < 0) {
            left = Math.min(0, firstRect.left - mainContentRect.left);
          }

          setSelectionBox({
            top: lastRect.bottom - mainContentRect.top,
            left: left,
            text: selectedText,
          });
          setIsInputVisible(false);
          setIsSelectionActive(true);
        } else {
          setIsValidSelectionOrigin(false);
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

      if (suggestionCardsContainerRef.current && 
          !suggestionCardsContainerRef.current.contains(event.target as Node) &&
          selectedSuggestionIndex !== null
      ) {
        handleSelectSuggestion(null); 
      }
    },
    [isSelectionActive, selectedSuggestionIndex, handleSelectSuggestion]
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

    const streamMessageParams: GraphInput = {
      messages: [convertToOpenAIFormat(humanMessage)],
      ...(selectionIndexes && {
        highlightedCode: {
          startCharIndex: selectionIndexes.start,
          endCharIndex: selectionIndexes.end,
        },
      }),
    };

    await streamMessage(streamMessageParams);
    props.setIsEditing(true);
  };

  const handleSuggestChangesToggle = useCallback((enabled: boolean) => {
    setShouldSuggestChanges(enabled);
  }, [setShouldSuggestChanges]);

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
        const contentEl = artifactContentRef.current;
        const highlightLayer = highlightLayerRef.current;

        highlightLayer.innerHTML = "";

        if (isSelectionActive && selectionBox) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            if (contentEl.contains(range.commonAncestorContainer)) {
              const rects = range.getClientRects();
              const contentElRect = contentEl.getBoundingClientRect();

              let startIndex = 0;
              let endIndex = 0;
              let currentArtifactContentForHighlight:
                | ArtifactCodeV3
                | ArtifactMarkdownV3
                | ArtifactBoardV3
                | undefined = undefined;
              try {
                currentArtifactContentForHighlight = artifact
                  ? getArtifactContent(artifact)
                  : undefined;
              } catch (_) {
                 console.error(
                  "[ArtifactRenderer.tsx L-highlight]\n\nERROR NO ARTIFACT CONTENT FOUND\n\n",
                  artifact
                );
              }

              if (currentArtifactContentForHighlight?.type === "code") {
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

                const verticalPadding = 3;
                highlightEl.style.left = `${rect.left - contentElRect.left}px`;
                highlightEl.style.top = `${rect.top - contentElRect.top - verticalPadding + contentEl.scrollTop}px`;
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
  }, [isSelectionActive, selectionBox, artifact]);

  useEffect(() => {
    if (!!selectedBlocks && !isSelectionActive) {
      setSelectedBlocks(undefined);
    }
  }, [selectedBlocks, isSelectionActive, setSelectedBlocks]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      if (
        (isInputVisible || selectionBox || isSelectionActive) &&
        !isInputActive
      ) {
        if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
          handleCleanupState();
        }
      }

      if ((isInputVisible || isSelectionActive) && e.key === "Escape") {
        handleCleanupState();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isInputVisible, selectionBox, isSelectionActive]);
 
  const handleBoardNoteUpdate: OnNoteUpdate = useCallback(
    (updatedIndex, updatedNoteData) => {
      if (!artifact || !currentArtifactContent || currentArtifactContent.type !== 'board') {
        console.error("Cannot update note: Invalid artifact state.");
        return;
      }
      try {
        const lines = currentArtifactContent.board.trim().split('\n');
        const notes = lines.map(line => JSON.parse(line));
        
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

        const updatedBoardString = notes.map(note => JSON.stringify(note)).join('\n');

        const updatedBoardContent: ArtifactBoardV3 = {
          ...currentArtifactContent,
          board: updatedBoardString,
        };

        const newContents = artifact.contents.map(content => 
          content.index === currentArtifactContent.index ? updatedBoardContent : content
        );

        setArtifact({
          ...artifact,
          contents: newContents,
        });

      } catch (error) {
        console.error("Failed to update board note:", error);
      }
    },
    [artifact, currentArtifactContent, setArtifact]
  );

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
    <div className="relative w-full h-full max-h-screen overflow-auto flex flex-col">
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
        onSuggestChangesToggle={handleSuggestChangesToggle}
      />
      <div className="flex flex-1 h-full overflow-hidden">
        <div
          ref={artifactContentRef}
          className={cn(
            "flex-1 flex justify-center overflow-y-auto relative transition-all duration-300 ease-in-out",
            showSuggestionsView ? "w-[calc(100%-24rem)]" : "w-[calc(100%-2.5rem)]",
            currentArtifactContent.type === "code" ? "pt-[10px]" : ""
          )}
        >
          <div 
            className={cn(
              "relative w-full h-full", // Apply w-full and h-full universally here
              // Max-width and centering should only apply if NOT text OR if panel is closed and we want centering for wide screens
              // For text content, let TextRenderer's internal padding define content width within this full-width container.
              // The centering `mx-auto` was for the whole block, TextRenderer itself isn't meant to be narrow then centered.
              currentArtifactContent.type !== "text" ? "max-w-4xl mx-auto" : "" 
            )}
          >
            <div
              className="h-full"
              onMouseEnter={() => setIsHoveringOverArtifact(true)}
              onMouseLeave={() => setIsHoveringOverArtifact(false)}
            >
              {currentArtifactContent.type === "text" ? (
                <TextRenderer
                  isInputVisible={isInputVisible}
                  isEditing={showSuggestionsView ? false : props.isEditing}
                  isHovering={isHoveringOverArtifact}
                  suggestedChanges={currentArtifactContent.suggestedChanges}
                  selectedSuggestionIndex={selectedSuggestionIndex}
                  onSuggestionHighlightClick={handleSelectSuggestion}
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
              className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
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
        {/* Suggestions Panel - Conditionally rendered and with a toggle button */}
        <div 
          className={cn(
            "flex-shrink-0 bg-gray-50 border-l border-gray-200 relative transition-all duration-300 ease-in-out z-10", 
            showSuggestionsView ? "w-96" : "w-10" 
          )}
        >
          <button 
            onClick={handleToggleSuggestionsView} 
            // Ensure button has a high enough z-index within its stacking context (created by transform or parent z-index)
            className="absolute top-2 -left-3 z-20 p-1 bg-gray-300 rounded-full hover:bg-gray-400 text-gray-700 transform shadow-md"
            aria-label={showSuggestionsView ? "Hide suggestions" : "Show suggestions"}
          >
            {showSuggestionsView ? (
              // ChevronRight when panel is OPEN (suggests collapsing to the right)
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /> 
              </svg>
            ) : (
              // ChevronLeft when panel is CLOSED (suggests expanding to the left)
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            )}
          </button>
          {showSuggestionsView && (
            // Inner div for content, with overflow-hidden
            <div className="w-full h-full overflow-hidden">
              <SuggestionCards 
                suggestions={currentArtifactContent.suggestedChanges} 
                selectedSuggestionIndex={selectedSuggestionIndex}
                onSelectSuggestion={handleSelectSuggestion}
                containerRef={suggestionCardsContainerRef} 
                cardYPositions={cardYPositions}
                cardRefs={cardRefs.current}
              />
            </div>
          )}
        </div>
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
