import {
  Artifact,
  ArtifactBoardV3,
  ArtifactCodeV3,
  ArtifactMarkdownV3,
  ArtifactV3,
} from "../types.js";

export const isArtifactCodeContent = (
  content: unknown
): content is ArtifactCodeV3 => {
  return !!(
    typeof content === "object" &&
    content &&
    "type" in content &&
    content.type === "code"
  );
};

export const isArtifactMarkdownContent = (
  content: unknown
): content is ArtifactMarkdownV3 => {
  return !!(
    typeof content === "object" &&
    content &&
    "type" in content &&
    content.type === "text"
  );
};



export const isArtifactBoardContent = (
  content: unknown
): content is ArtifactBoardV3 => {
  return !!(
    typeof content === "object" &&
    content &&
    "type" in content &&
    content.type === "board"
  );
};

export const isDeprecatedArtifactType = (
  artifact: unknown
): artifact is Artifact => {
  return !!(
    typeof artifact === "object" &&
    artifact &&
    "currentContentIndex" in artifact &&
    typeof artifact.currentContentIndex === "number"
  );
};

export const getArtifactContent = (
  artifact: ArtifactV3
): ArtifactCodeV3 | ArtifactMarkdownV3 | ArtifactBoardV3 | undefined => {
  if (!artifact) {
    return undefined;
  }
  const currentContent = artifact.contents.find(
    (a) => a.index === artifact.currentIndex
  );
  if (!currentContent) {
    return artifact.contents[artifact.contents.length - 1];
  }
  return currentContent;
};

export const getArtifactContentText = (
  content: ArtifactCodeV3 | ArtifactMarkdownV3 | ArtifactBoardV3 | undefined
): string => {
  if (!content) {
    return "";
  }
  if (isArtifactMarkdownContent(content)) {
    return content.fullMarkdown;
  }
  if (isArtifactCodeContent(content)) {
    return content.code;
  }
  if (isArtifactBoardContent(content)) {
    return ""; // Board content is visual, no text representation
  }
  return "";
};
