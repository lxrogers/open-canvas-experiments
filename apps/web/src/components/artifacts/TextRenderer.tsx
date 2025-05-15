import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { ArtifactMarkdownV3 } from "@opencanvas/shared/types";
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
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import { useGraphContext } from "@/contexts/GraphContext";
import React from "react";
import { TooltipIconButton } from "../ui/assistant-ui/tooltip-icon-button";
import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { Textarea } from "../ui/textarea";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { SuggestedChange } from "@opencanvas/shared/types";
import rehypeRaw from 'rehype-raw';

const cleanText = (text: string) => {
  return text.replaceAll("\\n", "\n");
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

interface TextRendererProps {
  isInputVisible: boolean;
  isEditing: boolean;
  isHovering: boolean;
  content?: string;
  suggestedChanges?: SuggestedChange[];
  selectedSuggestionIndex?: number | null;
  onContentChange: (newContent: string) => void;
}

export const TextRenderer: React.FC<TextRendererProps> = ({
  isInputVisible,
  isEditing,
  isHovering,
  content = "",
  suggestedChanges = [],
  selectedSuggestionIndex,
  onContentChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightBoxStyle, setHighlightBoxStyle] = useState<React.CSSProperties | null>(null);

  const editor = useCreateBlockNote({
    slashMenuItems: getDefaultReactSlashMenuItems(),
    uploadFile: async (file: File) => {
      console.warn("File upload not implemented for BlockNote. Returning placeholder.");
      return "https://via.placeholder.com/150?text=Uploaded+Image";
    },
    onEditorContentChange: async (editableEditor) => {
      const markdown = await editableEditor.blocksToMarkdownLossy(editableEditor.document);
      onContentChange(markdown);
    },
  });

  // Load content into BlockNote editor when isEditing is true or content changes
  useEffect(() => {
    if (isEditing && editor && typeof content === 'string') {
      const loadContentIntoEditor = async () => {
        const currentEditorMarkdown = editor.document.length > 0 ? await editor.blocksToMarkdownLossy(editor.document) : "";
        if (content !== currentEditorMarkdown) {
          const blocks = await editor.tryParseMarkdownToBlocks(content);
          editor.replaceBlocks(editor.document, blocks);
        }
      };
      loadContentIntoEditor();
    }
  }, [isEditing, content, editor]);

  // Process content with suggested changes (for ReactMarkdown view)
  const processContentWithSuggestions = (text: string, suggestions: SuggestedChange[]) => {
    let processedText = text;
    
    const sortedSuggestions = [...suggestions].sort((a, b) => {
      const posA = processedText.indexOf(a.prevText);
      const posB = processedText.indexOf(b.prevText);
      if (posA === -1 && posB === -1) return 0;
      if (posA === -1) return 1;
      if (posB === -1) return -1;
      return posA - posB;
    });

    for (let i = sortedSuggestions.length - 1; i >= 0; i--) {
      const suggestion = sortedSuggestions[i];
      const originalIndex = suggestions.findIndex(s => s === suggestion);
      const { prevText, suggestedText } = suggestion;
      const index = processedText.indexOf(prevText);
      
      if (index !== -1) {
        const prevTextId = `suggestion-prev-${originalIndex}`;
        // Removed direct border wrapping from here
        const replacement = `<span class="text-black line-through decoration-blue-500 decoration-2" data-prevtext-id="${prevTextId}">${prevText}</span>` +
                            `<span class="text-blue-700 ml-1">${suggestedText}</span>`;
        
        processedText = processedText.substring(0, index) + 
                       replacement + 
                       processedText.substring(index + prevText.length);
      }
    }
    return processedText;
  };

  const processedContent = processContentWithSuggestions(content, suggestedChanges);

  // Calculate highlight box style (for ReactMarkdown view)
  useEffect(() => {
    if (isEditing || !containerRef.current) { // Don't calculate if editing
      setHighlightBoxStyle(null);
      return;
    }

    const container = containerRef.current;

    if (selectedSuggestionIndex === null || selectedSuggestionIndex === undefined) {
      setHighlightBoxStyle(null);
      return;
    }

    const prevTextElement = container.querySelector(`[data-prevtext-id="suggestion-prev-${selectedSuggestionIndex}"]`) as HTMLElement;
    
    if (prevTextElement && prevTextElement.nextElementSibling) {
      const suggestedTextElement = prevTextElement.nextElementSibling as HTMLElement;
      const containerRect = container.getBoundingClientRect();
      const prevRect = prevTextElement.getBoundingClientRect();
      const suggestedRect = suggestedTextElement.getBoundingClientRect();

      // Determine the true top and left considering both elements
      const actualTop = Math.min(prevRect.top, suggestedRect.top);
      const actualLeft = Math.min(prevRect.left, suggestedRect.left);

      const top = actualTop - containerRect.top + container.scrollTop;
      const left = actualLeft - containerRect.left + container.scrollLeft;
      
      // Ensure right edge considers both elements if they wrap differently
      const rightMostPoint = Math.max(prevRect.right, suggestedRect.right);
      // Width is the difference between the rightmost and leftmost points of the combined elements
      const width = rightMostPoint - actualLeft;
      
      // Ensure bottom edge considers both elements
      const bottomMostPoint = Math.max(prevRect.bottom, suggestedRect.bottom);
      // Height is the difference between the bottommost and topmost points
      const height = bottomMostPoint - actualTop;

      setHighlightBoxStyle({
        position: "absolute",
        top: `${top - 2}px`, 
        left: `${left - 2}px`, 
        width: `${width + 4}px`, 
        height: `${height + 4}px`, 
        border: "2px solid #3B82F6", 
        borderRadius: "4px",
        pointerEvents: "none", 
        zIndex: 1, 
      });
    } else {
      setHighlightBoxStyle(null);
    }
  }, [selectedSuggestionIndex, processedContent, isEditing]); // Added isEditing dependency

  return (
    <div
      ref={containerRef}
      className={cn(
        "prose prose-sm max-w-none p-4 relative",
        isEditing ? "cursor-text" : "cursor-default",
        isEditing ? "bn-editor-override" : "" // Add a class for potential BlockNote specific styling overrides
      )}
    >
      {isEditing ? (
        <BlockNoteView
          editor={editor}
          theme="light" // Or "dark" or a custom theme object
        />
      ) : (
        <>
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
            {processedContent}
          </ReactMarkdown>
          {highlightBoxStyle && <div style={highlightBoxStyle} />}
        </>
      )}
    </div>
  );
};

export const TextRendererComponent = React.memo(TextRenderer);
