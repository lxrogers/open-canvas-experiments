import { ArtifactV3 } from "@opencanvas/shared/types";
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const NoteTakerGraphAnnotation = Annotation.Root({
  /**
   * The test messages to take notes on.
   */
  ...MessagesAnnotation.spec,
  /**
   * The artifact context for note taking.
   */
  artifact: Annotation<ArtifactV3 | undefined>,
  /**
   * Notes organized by category.
   */
  notes: Annotation<{
    goalsNotes: string[];
    styleNotes: string[];
    ideasNotes: string[];
    structureNotes: string[];
  }>,
});

export type NoteTakerGraphReturnType = {
  notes?: {
    goalsNotes: string[];
    styleNotes: string[];
    ideasNotes: string[];
    structureNotes: string[];
  };
  storedSuccessfully?: boolean;
}; 