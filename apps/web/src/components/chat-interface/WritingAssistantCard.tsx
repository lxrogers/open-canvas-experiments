import React from "react";
import { Button } from "../ui/button";

interface WritingAssistantCardProps {
  onClick?: () => void;
}

const WritingAssistantCard: React.FC<WritingAssistantCardProps> = ({ onClick }) => {
  return (
    <div
      className="w-full rounded-3xl flex flex-col justify-center items-start relative overflow-hidden mb-8 pr-64 pl-10 py-12"
      style={{
        background:
          "radial-gradient(circle at 20% 40%, #fbbf24 0%, transparent 60%), radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 60%), radial-gradient(circle at 60% 80%, #10b981 0%, transparent 60%), linear-gradient(120deg, #f472b6 0%, #60a5fa 100%)",
      }}
    >
      <div className="absolute inset-0 opacity-80" style={{ pointerEvents: 'none' }} />
      <div className="relative z-10 flex flex-col items-start justify-center h-full w-full">
        <h2 className="text-3xl font-bold text-white drop-shadow-lg mb-2 text-left">Writing Assistant</h2>
        <p className="text-lg text-white/90 mb-6 max-w-[18rem] text-left drop-shadow">
          Talk to an expert writing guide who can help you flesh out your thoughts and plan your document.
        </p>
        <Button
          className="px-8 py-3 text-lg font-semibold rounded-xl bg-white text-gray-900 shadow-lg hover:bg-gray-100 transition text-left"
          onClick={onClick}
        >
          Try Now
        </Button>
      </div>
    </div>
  );
};

export default WritingAssistantCard; 