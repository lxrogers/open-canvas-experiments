import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

interface NoteData {
  title: string;
  content: string;
  x: number;
  y: number;
  color: string;
}

// Prop for the callback function
export type OnNoteUpdate = (index: number, updatedNote: NoteData) => void;

export interface BoardRendererProps {
  boardContent: string;
  onNoteUpdate: OnNoteUpdate; // Add the callback prop
  isStreaming: boolean; // Add isStreaming prop
}

export const BoardRenderer: React.FC<BoardRendererProps> = ({ 
  boardContent, 
  onNoteUpdate,
  isStreaming // Destructure isStreaming
}) => {
  // State for initial parsed notes
  const initialNotes = useMemo(() => {
    if (!boardContent) return [];
    const lines = boardContent.trim().split('\n');
    const parsedNotes: NoteData[] = [];
    lines.forEach((line, index) => {
      try {
        const note = JSON.parse(line);
        // Basic validation including title
        if (
          typeof note.title === "string" &&
          typeof note.content === "string" &&
          typeof note.x === "number" &&
          typeof note.y === "number" &&
          typeof note.color === "string"
        ) {
          parsedNotes.push(note);
        } else {
          console.warn(`Invalid note format on line ${index + 1}:`, line);
        }
      } catch (error) {
        console.warn(`Failed to parse JSON on line ${index + 1}:`, line, error);
      }
    });
    return parsedNotes;
  }, [boardContent]);

  // State for temporary note positions during drag
  const [tempNotes, setTempNotes] = useState<NoteData[]>([]); // Initialize empty
  const [draggingNoteIndex, setDraggingNoteIndex] = useState<number | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [startAnimation, setStartAnimation] = useState(false); // State for animation trigger

  // Update tempNotes only when boardContent changes AND isStreaming is false
  useEffect(() => {
    if (!isStreaming) { 
        // Reset animation, then trigger after a tick to allow DOM update
        setStartAnimation(false); 
        setTempNotes(initialNotes); // Update notes first
        // Use setTimeout to trigger animation in the next render cycle
        const timer = setTimeout(() => {
            setStartAnimation(true);
        }, 50); // Small delay
        return () => clearTimeout(timer); // Cleanup timeout
    }
  }, [initialNotes, isStreaming]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>, index: number) => {
      if (draggingNoteIndex !== null) return; // Prevent starting a new drag if already dragging

      const noteElement = event.currentTarget;
      const rect = noteElement.getBoundingClientRect();
      const startOffset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      
      setOffset(startOffset);
      setDraggingNoteIndex(index);
      noteElement.style.cursor = 'grabbing'; // Change cursor during drag
      noteElement.style.zIndex = '1000'; // Bring dragged note to front

    }, [draggingNoteIndex] // Depend on draggingNoteIndex to prevent re-render issues
  );

  const handleMouseMove = useCallback((event: MouseEvent) => {
      if (draggingNoteIndex === null) return;

      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return; // Safety check

      // Calculate position relative to the container
      const newX = event.clientX - containerRect.left - offset.x;
      const newY = event.clientY - containerRect.top - offset.y;

      setTempNotes(currentNotes =>
        currentNotes.map((note, index) => {
          if (index === draggingNoteIndex) {
            // Adjust position based on the parent container's offset if necessary
            // For simplicity, assuming parent is the viewport for now.
            // A more robust solution might use getBoundingClientRect of the container.
            return { ...note, x: newX, y: newY };
          }
          return note;
        })
      );
    }, [draggingNoteIndex, offset, containerRef]
  );

  const handleMouseUp = useCallback(() => {
      if (draggingNoteIndex !== null) {
          const finalNoteData = tempNotes[draggingNoteIndex];
          // Find the potentially updated note element
          const noteElement = document.querySelector(`[data-note-index="${draggingNoteIndex}"]`) as HTMLDivElement | null;
          if (noteElement) {
             noteElement.style.cursor = 'grab';
             noteElement.style.zIndex = 'auto';
          }
          // Call the callback prop with the final data
          onNoteUpdate(draggingNoteIndex, finalNoteData);
      }
      setDraggingNoteIndex(null);
    }, [draggingNoteIndex, tempNotes, onNoteUpdate] // Add dependencies
  );

  // Effect to add and remove global mouse listeners
  useEffect(() => {
    if (draggingNoteIndex !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    // Cleanup function
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingNoteIndex, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative", // Container for absolute positioning
        width: "100%",
        minHeight: "1200px", // Increased height
        padding: "20px", // Add some padding
        overflow: "auto", // Add scroll if notes go out of bounds
      }}
    >
      {/* Loading Overlay */} 
      {isStreaming && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255, 255, 255, 0.7)", // White with 50% opacity
            zIndex: 500, // Ensure it's above the notes
            display: 'flex', // Optional: for centering loading text/spinner later
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Optional: Add loading text or spinner here */}
          {/* <p>Loading...</p> */}
        </div>
      )}

      {/* Notes Rendering */} 
      {tempNotes.map((note, index) => {
        // Determine if the current note is being dragged
        const isCurrentNoteDragging = index === draggingNoteIndex;

        return (
          <div
            key={index}
            data-note-index={index} 
            onMouseDown={(e) => handleMouseDown(e, index)}
            style={{
              position: "absolute",
              left: `${note.x}px`,
              top: `${note.y}px`,
              backgroundColor: note.color,
              padding: "10px 15px",
              borderRadius: "5px",
              boxShadow: "0px 1px 5px 1px rgba(0, 0, 0, 0.2)",
              width: "175px",
              minHeight: "210px",
              fontSize: "14px",
              lineHeight: "1.4",
              wordWrap: "break-word",
              cursor: 'grab',
              userSelect: 'none',
              // Apply transition including opacity
              transition: isCurrentNoteDragging 
                ? "none" 
                : "left 1s ease-out, top 1s ease-out, background-color 1s ease-out, opacity 0.5s ease-out", // Added opacity transition (0.5s)
              zIndex: isCurrentNoteDragging ? 1000 : 'auto',
              // Control opacity based on animation state
              opacity: startAnimation ? 1 : 0, 
            }}
          >
            {/* Title */} 
            <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>
                {note.title}
            </div>
            {/* Content */} 
            <div style={{ fontSize: '12px' }}>
                {note.content}
            </div>
          </div>
        )
      })}
    </div>
  );
}; 