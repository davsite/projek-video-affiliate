// Material transitions. A material's look is a plain number tree (MatState), so it can live
// inside era definitions. Between eras the change does not fade globally: a front travels
// along the object (top → bottom in object space, attribute `tfPos`) and each fragment flips
// from state A to state B as it passes, with a thin light band riding the front — the
// TIMEFORGE "time scan". Clearcoat, sheen and iridescence blend with the same progress.

import { Color, MeshPhysicalMaterial, SRGBColorSpace, type Side, type Texture } from "three";
import { patchSoftboxOnly } from "./softboxOnly.ts";

export type Rgb = [number, number, number];
export type MatState = {
  color: Rgb;
  rough: number;
  metal: number;
  cc: number;
  ccRough: number;
  sheen: number;
  irid: number;
  aniso: number;
  emissive: Rgb;
  emissiveI: number;
};

export const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

export const mat = (color: string, o: Partial<Omit<MatState, "color">> = {}): MatState => ({
  color: hex(color),
  rough: 0.5,
  metal: 0,
  cc: 0,
  ccRough: 0.1,
  sheen: 0,
  irid: 0,
  aniso: 0,
  emissive: [0, 0, 0],
  emissiveI: 0,
  ...o,
});

/** Where the scan front is: 0 = not started (all A), 1 = done (all B). */
export type Sweep = { progress: number; top: number; bottom: number; band: number };

type TfUniforms = {
  tfColor2: { value: Color };
  tfRough2: { value: number };
  tfMetal2: { value: number };
  tfFront: { value: number };
  tfSoft: { value: number };
  tfBand: { value: number };
  tfBandW: { value: number };
  tfBandColor: { value: Color };
};

const BAND_COLOR = new Color("#bfeff2"); // light cyan, never neon

type MatOpts = { map?: Texture; emissiveMap?: Texture; side?: Side; transparent?: boolean };
const defined = (o: MatOpts) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export const sweepMaterial = (o: MatOpts = {}) => {
  const m = new MeshPhysicalMaterial(defined(o));
  const u: TfUniforms = {
    tfColor2: { value: new Color() },
    tfRough2: { value: 0.5 },
    tfMetal2: { value: 0 },
    tfFront: { value: 1e4 },
    tfSoft: { value: 0.35 },
    tfBand: { value: 0 },
    tfBandW: { value: 0.09 },
    tfBandColor: { value: BAND_COLOR.clone() },
  };
  m.userData.tf = u;
  m.onBeforeCompile = (shader) => {
    patchSoftboxOnly(shader);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 tfPos;\nvarying vec3 vTf;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTf = tfPos;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform vec3 tfColor2; uniform float tfRough2; uniform float tfMetal2; uniform float tfFront; uniform float tfSoft;
uniform float tfBand; uniform float tfBandW; uniform vec3 tfBandColor;
varying vec3 vTf;`,
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nfloat tfk = smoothstep(tfFront - tfSoft, tfFront + tfSoft, vTf.y);\ndiffuseColor.rgb = mix(diffuseColor.rgb, tfColor2, tfk);",
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, tfRough2, tfk);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, tfMetal2, tfk);")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\nfloat tfd = (vTf.y - tfFront) / tfBandW;\ntotalEmissiveRadiance += tfBandColor * tfBand * exp(-tfd * tfd);",
      );
  };
  m.customProgramCacheKey = () => "tf-sweep";
  return m;
};

/** A plain physical material that follows the same look rules (no sweep). */
export const plainMaterial = (o: MatOpts = {}) => {
  const m = new MeshPhysicalMaterial(defined(o));
  m.onBeforeCompile = (shader) => patchSoftboxOnly(shader);
  m.customProgramCacheKey = () => "tf-plain";
  return m;
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Apply A→B with a scan front at `sw.progress`; plain materials just take the blend. */
export const applyMat = (m: MeshPhysicalMaterial, A: MatState, B: MatState, sw: Sweep) => {
  const t = Math.min(1, Math.max(0, sw.progress));
  const u = m.userData.tf as TfUniforms | undefined;
  const lerp3 = (a: Rgb, b: Rgb, k: number): Rgb => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
  if (u) {
    m.color.setRGB(...A.color, SRGBColorSpace);
    m.roughness = A.rough;
    m.metalness = A.metal;
    u.tfColor2.value.setRGB(...B.color, SRGBColorSpace);
    u.tfRough2.value = B.rough;
    u.tfMetal2.value = B.metal;
    const soft = u.tfSoft.value;
    u.tfFront.value = mix(sw.top + soft, sw.bottom - soft, t);
    // the band lives only while the front is on the object
    u.tfBand.value = sw.band * Math.sin(Math.PI * t) ** 0.6;
  } else {
    m.color.setRGB(...lerp3(A.color, B.color, t), SRGBColorSpace);
    m.roughness = mix(A.rough, B.rough, t);
    m.metalness = mix(A.metal, B.metal, t);
  }
  m.clearcoat = mix(A.cc, B.cc, t);
  m.clearcoatRoughness = mix(A.ccRough, B.ccRough, t);
  m.sheen = mix(A.sheen, B.sheen, t);
  m.sheenRoughness = 0.5;
  m.sheenColor.setRGB(1, 1, 1);
  m.iridescence = mix(A.irid, B.irid, t);
  m.iridescenceIOR = 1.3;
  m.anisotropy = mix(A.aniso, B.aniso, t);
  m.emissive.setRGB(...lerp3(A.emissive, B.emissive, t), SRGBColorSpace);
  m.emissiveIntensity = mix(A.emissiveI, B.emissiveI, t);
};
