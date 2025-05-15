import { ReflectionsDialog } from "../../reflections-dialog/ReflectionsDialog";
import { ArtifactTitle } from "./artifact-title";
import { NavigateArtifactHistory } from "./navigate-artifact-history";
import {
  ArtifactCodeV3,
  ArtifactMarkdownV3,
  ArtifactBoardV3,
} from "@opencanvas/shared/types";
import { Assistant } from "@langchain/langgraph-sdk";
import { PanelRightClose } from "lucide-react";
import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";

interface ArtifactHeaderProps {
  isBackwardsDisabled: boolean;
  isForwardDisabled: boolean;
  setSelectedArtifact: (index: number) => void;
  currentArtifactContent: ArtifactCodeV3 | ArtifactMarkdownV3 | ArtifactBoardV3;
  isArtifactSaved: boolean;
  totalArtifactVersions: number;
  selectedAssistant: Assistant | undefined;
  artifactUpdateFailed: boolean;
  chatCollapsed: boolean;
  setChatCollapsed: (c: boolean) => void;
  onSuggestChangesToggle?: (enabled: boolean) => void;
}

export function ArtifactHeader(props: ArtifactHeaderProps) {
  return (
    <div className="flex flex-row items-center justify-between">
      <div className="flex flex-row items-center justify-center gap-2">
        {props.chatCollapsed && (
          <TooltipIconButton
            tooltip="Expand Chat"
            variant="ghost"
            className="ml-2 mb-1 w-8 h-8"
            delayDuration={400}
            onClick={() => props.setChatCollapsed(false)}
          >
            <PanelRightClose className="text-gray-600" />
          </TooltipIconButton>
        )}
        <ArtifactTitle
          title={props.currentArtifactContent.title}
          isArtifactSaved={props.isArtifactSaved}
          artifactUpdateFailed={props.artifactUpdateFailed}
        />
      </div>
      <div className="flex gap-2 items-end mt-[10px] mr-[6px]">
        <div className="flex items-center gap-2 mr-2">
          <label className="text-sm text-gray-600">Suggest Changes</label>
          <input
            type="checkbox"
            onChange={(e) => props.onSuggestChangesToggle?.(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
        </div>
        <NavigateArtifactHistory
          isBackwardsDisabled={props.isBackwardsDisabled}
          isForwardDisabled={props.isForwardDisabled}
          setSelectedArtifact={props.setSelectedArtifact}
          currentArtifactIndex={props.currentArtifactContent.index}
          totalArtifactVersions={props.totalArtifactVersions}
        />
        <ReflectionsDialog selectedAssistant={props.selectedAssistant} />
      </div>
    </div>
  );
}
