import React, { useEffect, useState } from 'react';
import { ArtifactMarkdownV3 } from '@opencanvas/shared/types';
import { useGraphContext } from '@/contexts/GraphContext';
import { useAssistantContext } from '@/contexts/AssistantContext';
import { useThreadContext } from '@/contexts/ThreadProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoaderCircle } from 'lucide-react';

interface Notes {
  goalsNotes: string[];
  styleNotes: string[];
  ideasNotes: string[];
  structureNotes: string[];
}

export interface AssistedTextRendererProps {
  isEditing: boolean; // This prop might influence how it displays or if it allows edits later
  // Add other props as they become necessary
}

const AssistedTextRendererComponent: React.FC<AssistedTextRendererProps> = (_props) => {
  const { graphData } = useGraphContext();
  const { artifact, isNoteTakerRunning, noteTakerVersion } = graphData;
  const { selectedAssistant } = useAssistantContext();
  const { threadId } = useThreadContext();
  const [notes, setNotes] = useState<Notes | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  const currentContent = artifact?.contents[artifact.currentIndex] as ArtifactMarkdownV3 | undefined;
  const markdownToDisplay = currentContent?.fullMarkdown || "";

  const fetchNotes = async () => {
    if (!selectedAssistant || !threadId) {
      console.log("Cannot fetch notes - missing:", { selectedAssistant: !!selectedAssistant, threadId });
      return;
    }
    
    console.log("Fetching notes for:", { assistantId: selectedAssistant.assistant_id, threadId });
    setIsLoadingNotes(true);
    try {
      const res = await fetch("/api/store/get", {
        method: "POST",
        body: JSON.stringify({
          namespace: ["notes", selectedAssistant.assistant_id, threadId],
          key: "ghostwriter_notes",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Fetch notes response status:", res.status);
      
      if (res.ok) {
        const { item } = await res.json();
        console.log("Fetched notes item:", item);
        if (item?.value) {
          console.log("Setting notes:", item.value);
          setNotes(item.value);
        } else {
          console.log("No notes found in response");
        }
      } else {
        console.error("Failed to fetch notes - status:", res.status);
      }
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Fetch notes when component mounts, assistant changes, thread changes, or noteTaker completes
  useEffect(() => {
    console.log("Notes fetch effect triggered:", { 
      selectedAssistant: selectedAssistant?.assistant_id, 
      threadId, 
      noteTakerVersion,
      isNoteTakerRunning 
    });
    fetchNotes();
  }, [selectedAssistant, threadId, noteTakerVersion]);

  // Remove early return - let tabs render even without content

  const renderNotes = () => {
    if (!notes) {
      return <div className="text-gray-500">No notes available yet. Start a conversation to generate notes.</div>;
    }

    const noteSections = [
      { title: "Goals", notes: notes.goalsNotes },
      { title: "Style", notes: notes.styleNotes },
      { title: "Ideas", notes: notes.ideasNotes },
      { title: "Structure", notes: notes.structureNotes },
    ];

    return (
      <div className="space-y-6">
        {noteSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
            {section.notes && section.notes.length > 0 ? (
              <ul className="list-disc list-inside space-y-1">
                {section.notes.map((note, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    {note}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">No {section.title.toLowerCase()} notes yet</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="assisted-text-renderer p-8 flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-4">Writing Assistant</h2>
      
      <Tabs defaultValue="notes" className="flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="notes" className="flex items-center gap-2">
            Notes
            {isNoteTakerRunning && (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            )}
          </TabsTrigger>
          <TabsTrigger value="outline">Outline</TabsTrigger>
        </TabsList>
        
        <TabsContent value="notes" className="flex-grow overflow-auto">
          <div className="border rounded-md p-6 bg-white h-full relative">
            {renderNotes()}
            {/* Loading overlay */}
            {isNoteTakerRunning && (
              <div className="absolute inset-0 bg-black bg-opacity-20 rounded-md transition-opacity duration-300" />
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="outline" className="flex-grow overflow-auto">
          <div className="border rounded-md p-6 bg-white h-full">
            <p className="text-sm text-gray-600 mb-4">
              Document outline will appear here (Currently showing raw markdown)
            </p>
            <pre className="whitespace-pre-wrap text-sm text-gray-700">
              {markdownToDisplay}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const AssistedTextRenderer = React.memo(AssistedTextRendererComponent); 