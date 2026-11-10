// This video's composition: the CHARACTER FLOW story film (the kit, untouched) with the product inserts cut in on the
// words where the VO talks about the cable and the clip. Only one 3D stage is mounted per frame, so an insert costs
// no more than the shot it replaces.

import React, { useMemo } from "react";
import { AbsoluteFill, Composition, Html5Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PRESETS } from "../core/film/frame.ts";
import { productionOf, StoryFilm } from "../kits/characterflow/director/StoryFilm.tsx";
import type { Story } from "../kits/characterflow/director/story.ts";
import { chunkWords } from "../kits/characterflow/captions/Captions.tsx";
import { STORIES } from "../stories/registry.ts";
import { InsertFrame } from "./Insert.tsx";
import { insertAt } from "./shots.ts";

export const ID = "klip-kabel";

const Film: React.FC<{ story: Story; audio?: string }> = ({ story, audio }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const F = productionOf(story);
  const chunks = useMemo(() => chunkWords(F.cues.words, F.cues.offset, story.highlights ?? []), [F, story.highlights]);
  const ins = insertAt(t);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {ins ? <InsertFrame s={ins.at(t)} t={t} t1={ins.t1} frame={frame} chunks={chunks} /> : <StoryFilm story={story} />}
      {audio ? (
        <Sequence from={0} layout="none">
          <Html5Audio src={staticFile(audio)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

export const KlipFilms: React.FC = () => {
  const story = STORIES.find((s) => s.id === ID);
  if (!story) return null;
  const d = productionOf(story).duration;
  const { preview, final } = PRESETS;
  return (
    <>
      <Composition id={`${ID}-ov-preview`} component={Film} defaultProps={{ story, audio: `audio/${ID}-final-mix.wav` }} durationInFrames={Math.round(d * preview.fps)} fps={preview.fps} width={preview.width} height={preview.height} />
      <Composition id={`${ID}-ov-final`} component={Film} defaultProps={{ story }} durationInFrames={Math.round(d * final.fps)} fps={final.fps} width={final.width} height={final.height} />
    </>
  );
};
