// Camera + finishing chain (from PRECISION; proven in PRECISION, TIMEFORGE and BUILDFORGE).
// The rig applies the shot for this frame before R3F advances, then the composer renders: scene (MSAA) → ground-truth AO → depth of field → restrained
// bloom → Khronos PBR Neutral tone mapping → grade (warmth, vignette, fine grain).

import React, { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { type Camera, HalfFloatType, NeutralToneMapping, PerspectiveCamera, Vector2, WebGLRenderTarget } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { Pass } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Render layer for additive / volumetric effects (light shafts, glows, halos, beams). Put such
 * meshes on this layer ONLY (`mesh.layers.set(FX_LAYER)`): the camera still renders them, but the
 * depth-based passes (GTAO, depth of field) skip them. Large transparent volumes on the default
 * layer corrupt those passes and can silently blank the whole frame.
 */
export const FX_LAYER = 1;

/** Run a pass with the FX layer hidden from the camera (depth/normal passes must not see effects). */
export const withoutFx = <P extends Pass>(pass: P, camera: Camera): P => {
  const render = pass.render.bind(pass);
  pass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
    camera.layers.disable(FX_LAYER);
    try {
      render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    } finally {
      camera.layers.enable(FX_LAYER);
    }
  };
  return pass;
};

export type Shot = {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  roll?: number;
  /** Focus distance (world units) and lens aperture for the bokeh pass. */
  focus: number;
  aperture: number;
  maxBlur: number;
  exposure: number;
};

export const CameraRig: React.FC<{ shot: Shot; near?: number; far?: number }> = ({ shot, near = 1, far = 900 }) => {
  const { camera, gl } = useThree();
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.position.set(...shot.pos);
    cam.up.set(Math.sin(shot.roll ?? 0), Math.cos(shot.roll ?? 0), 0);
    cam.lookAt(...shot.target);
    cam.fov = shot.fov;
    cam.near = near;
    cam.far = far;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    cam.layers.enable(FX_LAYER);
    gl.toneMapping = NeutralToneMapping;
    gl.toneMappingExposure = shot.exposure;
  }, [shot, camera, gl, near, far]);
  return null;
};

/**
 * Replaces non-finite pixels (NaN/Inf from a faulty custom shader) right after the scene render.
 * Without it, bloom spreads a single NaN pixel across the whole frame and the frame renders blank
 * with no error — found in testing with a custom light-shaft shader.
 */
const NanGuardShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = clamp(c, 0.0, 64.0); }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.14 },
    uGrain: { value: 0.012 },
    uRes: { value: new Vector2(1080, 1920) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uGrain; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      // ivory highlights, a breath of cool in the shadows
      c.rgb += smoothstep(0.6, 1.0, l) * vec3(0.002, 0.001, -0.003);
      c.rgb += (1.0 - smoothstep(0.0, 0.5, l)) * vec3(-0.004, 0.0, 0.006);
      // gentle S-curve: deeper form shadows without crushing the whites
      c.rgb = mix(c.rgb, c.rgb * c.rgb * (3.0 - 2.0 * c.rgb), 0.24);
      vec2 d = (vUv - 0.5) * vec2(1.0, 1.25);
      c.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(d));
      float g = hash(vUv * uRes + uTime * 17.0) - 0.5;
      c.rgb += g * uGrain;
      gl_FragColor = c;
    }`,
};

export const Post: React.FC<{ shot: Shot; frame: number; ao?: boolean; aoRadius?: number }> = ({ shot, frame, ao = true, aoRadius = 0.28 }) => {
  const { gl, scene, camera, size } = useThree();
  const chain = useMemo(() => {
    const w = size.width, h = size.height;
    const rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, rt);
    composer.setPixelRatio(1);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass(NanGuardShader));
    if (ao) {
      const gtao = new GTAOPass(scene, camera, w, h);
      gtao.blendIntensity = 1.0;
      gtao.updateGtaoMaterial({ radius: aoRadius, distanceExponent: 1.8, thickness: 0.5, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
      composer.addPass(withoutFx(gtao, camera));
    }
    const dof = withoutFx(new BokehPass(scene, camera, { focus: 10, aperture: 0.002, maxblur: 0.008 }), camera);
    composer.addPass(dof);
    const bloom = new UnrealBloomPass(new Vector2(w, h), 0.14, 0.45, 2.2);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GradeShader);
    grade.uniforms.uRes.value.set(w, h);
    composer.addPass(grade);
    return { composer, dof, grade };
  }, [gl, scene, camera, size.width, size.height, ao, aoRadius]);

  useLayoutEffect(() => {
    const u = chain.dof.uniforms as unknown as Record<string, { value: number }>;
    u.focus.value = shot.focus;
    u.aperture.value = shot.aperture;
    u.maxblur.value = shot.maxBlur;
    chain.dof.enabled = shot.maxBlur > 0 && shot.aperture > 0;
    chain.grade.uniforms.uTime.value = frame % 997;
  }, [frame, chain, shot]);

  useFrame(() => {
    chain.composer.render();
  }, 1);
  return null;
};
