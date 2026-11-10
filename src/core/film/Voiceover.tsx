// Voice-over placed `offset` seconds into the film (file under public/). Used for Studio preview
// and non-muted renders; final delivery muxes the same file at the same offset with
// scripts/render-final.mjs, so both paths agree.

import React from "react";
import { Html5Audio, Sequence, staticFile, useVideoConfig } from "remotion";

export const Voiceover: React.FC<{ src: string; offset: number }> = ({ src, offset }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={Math.round(offset * fps)} layout="none">
      <Html5Audio src={staticFile(src)} />
    </Sequence>
  );
};
