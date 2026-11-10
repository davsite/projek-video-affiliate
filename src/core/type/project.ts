import { PerspectiveCamera, Vector3 } from "three";
import type { Shot } from "../render/Post.tsx";

/** Project a world point to pixel coordinates with exactly the film camera for this frame. */
export const projector = (shot: Shot, width: number, height: number) => {
  const cam = new PerspectiveCamera(shot.fov, width / height, 0.05, 1200);
  cam.position.set(...shot.pos);
  cam.up.set(Math.sin(shot.roll ?? 0), Math.cos(shot.roll ?? 0), 0);
  cam.lookAt(...shot.target);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return (p: Vector3): [number, number] => {
    const v = p.clone().project(cam);
    return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
  };
};
