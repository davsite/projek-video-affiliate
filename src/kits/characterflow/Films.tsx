import React from "react";
import { Composition } from "remotion";
import { PRESETS } from "../../core/film/frame.ts";
import { STORIES } from "../../stories/registry.ts";
import { CharLook, CARDS } from "./look/CharLook.tsx";
import { StoryFilm, productionOf } from "./director/StoryFilm.tsx";

// CHARACTER FLOW compositions. scripts/make.mjs adds <CharacterFlowFilms /> to src/Root.tsx once; every story in
// src/stories/data is then registered twice: <id>-preview (540 × 960 @ 30, with the mix) and <id>-final
// (1080 × 1920 @ 60, muted — render-final lays the mastered mix in).
const { preview, final } = PRESETS;

export const CharacterFlowFilms: React.FC = () => (
  <>
    {STORIES.map((s) => {
      // a story that does not compile (being edited, a typo) is left out instead of breaking every other story's render
      let d: number;
      try { d = productionOf(s).duration; } catch (e) { console.warn(`story "${s.id}" skipped: ${(e as Error).message.split("\n")[0]}`); return null; }
      return (
        <React.Fragment key={s.id}>
          <Composition id={`${s.id}-preview`} component={StoryFilm} defaultProps={{ story: s, audio: `audio/${s.id}-mix.wav` }} durationInFrames={Math.round(d * preview.fps)} fps={preview.fps} width={preview.width} height={preview.height} />
          <Composition id={`${s.id}-final`} component={StoryFilm} defaultProps={{ story: s }} durationInFrames={Math.round(d * final.fps)} fps={final.fps} width={final.width} height={final.height} />
        </React.Fragment>
      );
    })}
    {/* character proof sheet: every look, expression and gesture */}
    <Composition id="CharacterFlowLook" component={CharLook} durationInFrames={CARDS.length} fps={preview.fps} width={preview.width} height={preview.height} />
  </>
);
