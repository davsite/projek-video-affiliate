// Studio lighting rule (from PRECISION): highlights come only from area lights (the HDR
// light stage). Punctual lights keep their diffuse contribution and shadows, but their
// specular lobes — the tell-tale CG pinpoint on clearcoat — are removed from the shader.

import { ShaderChunk, type WebGLProgramParametersWithUniforms } from "three";

const SRC = ShaderChunk.lights_physical_pars_fragment;
const PATCHED = SRC.replace("clearcoatSpecularDirect += ccIrradiance", "clearcoatSpecularDirect += 0.0 * ccIrradiance").replace(
  "reflectedLight.directSpecular += irradiance * specularBRDF",
  "reflectedLight.directSpecular += 0.0 * irradiance * specularBRDF",
);
if (PATCHED === SRC) console.warn("softboxOnly: shader chunk changed; punctual specular not removed");

export const patchSoftboxOnly = (shader: WebGLProgramParametersWithUniforms) => {
  shader.fragmentShader = shader.fragmentShader.replace("#include <lights_physical_pars_fragment>", PATCHED);
};
