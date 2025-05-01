import React from "react";

export interface BoardRendererProps {
  // Add any specific props needed for board rendering later
}

export const BoardRenderer: React.FC<BoardRendererProps> = () => {
  return (
    <div
      style={{
        width: "100%",
        height: "500px", // Example height, adjust as needed
        backgroundColor: "red",
      }}
    >
      {/* Board content will go here */}
    </div>
  );
}; 