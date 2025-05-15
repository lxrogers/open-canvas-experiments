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
}

export const TextRenderer: React.FC<TextRendererProps> = ({
  isInputVisible,
  isEditing,
  isHovering,
  content = "",
  suggestedChanges = [],
}) => {
  // Process content with suggested changes
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
      // Find original index of suggestion to create a stable ID
      const originalIndex = suggestions.findIndex(s => s === suggestion);
      const { prevText, suggestedText } = suggestion;
      const index = processedText.indexOf(prevText);
      
      if (index !== -1) {
        const prevTextId = `suggestion-prev-${originalIndex}`;
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

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none p-4",
        isEditing ? "cursor-text" : "cursor-default"
      )}
    >
      <ReactMarkdown rehypePlugins={[rehypeRaw]}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export const TextRendererComponent = React.memo(TextRenderer);
