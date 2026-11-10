// Environment components by id (the drawing side of registry.ts). Add new environments here.

import React from "react";
import type { Cam } from "../render/FilmPost.tsx";
import type { Skeleton } from "../character/skeleton.ts";
import { Bedroom, bedroomMats, BEDROOM } from "./Bedroom.tsx";
import { Blanket, bodyCapsules } from "./Blanket.tsx";
import { Campus, CAMPUS } from "./Campus.tsx";
import { Room } from "./Room.tsx";
import { ROOMS } from "./room.data.ts";
import type { EnvId, TimeOfDay } from "./registry.ts";

export const EnvView: React.FC<{ id: EnvId; time: TimeOfDay; cam: Cam; lamp: number; bedSk?: { sk: Skeleton; scale: number; edge: number } }> = ({ id, time, cam, lamp, bedSk }) => {
  if (id === "campus") return <Campus L={CAMPUS} />;
  if (id !== "bedroom") return <Room L={ROOMS[id]} time={time} />;
  const M = bedroomMats(BEDROOM);
  return (
    <>
      <Bedroom L={BEDROOM} lamp={lamp} clockText={time === "night" ? "02:00" : "07:30"} clockGlow={time === "night" ? 0.9 : 0.4} ceiling={cam.pos[1] < 2.6} />
      <Blanket bed={BEDROOM.bed} edge={bedSk ? bedSk.edge : -0.62} caps={bedSk ? bodyCapsules(bedSk.sk, bedSk.scale) : []} materials={[M.duvet, M.cuff]} />
    </>
  );
};
