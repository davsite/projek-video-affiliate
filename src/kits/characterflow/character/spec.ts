// CHARACTERFLOW character specs: everything that makes one character look like himself (palette,
// proportions, hair, clothing) lives here, so the same rig, poses and performances drive any cast
// member. Rig dimensions (DIMS) are shared by every character; a spec only scales them.

export type V3 = [number, number, number];

export type HairStyle = "swoop" | "crop" | "bun" | "curly" | "long" | "hijab";
export type TopKind = "tee" | "shirt" | "hoodie";

export type CharacterSpec = {
  id: string;
  /** overall height scale (1 = 1.80 m rig) */
  scale: number;
  /** stylisation: head and hand size relative to the realistic rig */
  headScale: number;
  handScale: number;
  /** body width (1 = average) */
  build: number;
  skin: string;
  /** cheek blush strength 0…1 */
  blush: number;
  hair: string;
  hairSheen: string;
  hairStyle: HairStyle;
  brow: string;
  iris: string;
  lip: string;
  top: { kind: TopKind; color: string; accent: string; sleeve: "short" | "long" };
  bottom: { color: string; kind: "pants" | "shorts" | "skirt" };
  feet: { kind: "socks" | "shoes" | "bare"; color: string };
  glasses?: boolean;
  beard?: boolean;
  /** hijab colour (hairStyle "hijab") */
  scarf?: string;
  /** moustache (older men) */
  moustache?: boolean;
};

/** Shared rig dimensions in unscaled metres (character faces +Z, his left is +X). */
export const DIMS = {
  pelvisH: 0.96,
  spineY: 0.1,
  chestY: 0.2,
  neckY: 0.27,
  headY: 0.075,
  headCenter: [0, 0.11, 0.012] as V3,
  shoulder: [0.185, 0.205, -0.012] as V3,
  upperArm: 0.28,
  foreArm: 0.25,
  hip: [0.095, -0.05, 0] as V3,
  thigh: 0.43,
  shin: 0.42,
};

/** The CHARACTERFLOW lead: a young adult man — warm, slightly scruffy, instantly readable. */
export const RAKA: CharacterSpec = {
  id: "raka",
  scale: 0.94,
  headScale: 1.36,
  handScale: 1.1,
  build: 1,
  skin: "#c98c62",
  blush: 0.55,
  hair: "#231812",
  hairSheen: "#8a6248",
  hairStyle: "swoop",
  brow: "#20150f",
  iris: "#5a3417",
  lip: "#a35f52",
  top: { kind: "tee", color: "#f0b23e", accent: "#fff3d6", sleeve: "short" },
  bottom: { color: "#3c4a6b", kind: "pants" },
  feet: { kind: "socks", color: "#e8e4dc" },
};

/** Supporting cast for imagined scenes — same rig, different specs. */
export const FRIEND: CharacterSpec = {
  ...RAKA,
  id: "friend",
  scale: 0.9,
  headScale: 1.3,
  skin: "#a8724e",
  hair: "#120d0a",
  hairStyle: "crop",
  iris: "#3a2414",
  top: { kind: "shirt", color: "#4f9fd6", accent: "#e9f4ff", sleeve: "short" },
  bottom: { color: "#2d2f36", kind: "pants" },
  feet: { kind: "shoes", color: "#f1f1f1" },
};

export const BOSS: CharacterSpec = {
  ...RAKA,
  id: "boss",
  scale: 0.97,
  headScale: 1.28,
  build: 1.12,
  skin: "#d9a07a",
  hair: "#4a4440",
  hairStyle: "crop",
  iris: "#2a2a30",
  glasses: true,
  beard: true,
  top: { kind: "shirt", color: "#dedad2", accent: "#9b2f3a", sleeve: "long" },
  bottom: { color: "#26293a", kind: "pants" },
  feet: { kind: "shoes", color: "#2a2120" },
};

export const NAYA: CharacterSpec = {
  ...RAKA,
  id: "naya",
  scale: 0.88,
  headScale: 1.32,
  skin: "#b77d55",
  hair: "#1a110c",
  hairStyle: "bun",
  iris: "#43260f",
  lip: "#b05a55",
  top: { kind: "hoodie", color: "#e76f6f", accent: "#ffe0d6", sleeve: "long" },
  bottom: { color: "#e9d9bd", kind: "pants" },
  feet: { kind: "shoes", color: "#fafafa" },
};

/** Raka outdoors: same character, sneakers instead of socks. */
export const RAKA_OUT: CharacterSpec = { ...RAKA, feet: { kind: "shoes", color: "#f4f2ec" } };

/** Bima — Raka's old friend: taller, broader, curly hair, round glasses, sage hoodie, khakis. */
export const BIMA: CharacterSpec = {
  ...RAKA,
  id: "bima",
  scale: 0.98,
  headScale: 1.3,
  handScale: 1.1,
  build: 1.07,
  skin: "#94603f",
  blush: 0.45,
  hair: "#16100c",
  hairSheen: "#6b4a36",
  hairStyle: "curly",
  brow: "#140e0a",
  iris: "#3a2312",
  lip: "#8f4f45",
  glasses: true,
  top: { kind: "hoodie", color: "#7fb59a", accent: "#f3ead8", sleeve: "long" },
  bottom: { color: "#c9b48c", kind: "pants" },
  feet: { kind: "shoes", color: "#2f3a4f" },
};

/** Sari — a young woman in a hijab: tunic, long skirt. */
export const SARI: CharacterSpec = {
  ...RAKA,
  id: "sari",
  scale: 0.87,
  headScale: 1.33,
  build: 0.96,
  skin: "#c58b63",
  blush: 0.6,
  hair: "#1a110c",
  hairStyle: "hijab",
  scarf: "#e8a0b4",
  iris: "#43260f",
  lip: "#b5605a",
  top: { kind: "shirt", color: "#e4ddd1", accent: "#e8a0b4", sleeve: "long" },
  bottom: { color: "#5b6e8c", kind: "skirt" },
  feet: { kind: "shoes", color: "#f4f2ec" },
};

/** Dinda — a young woman with shoulder-length hair, tee and jeans. */
export const DINDA: CharacterSpec = {
  ...RAKA,
  id: "dinda",
  scale: 0.87,
  headScale: 1.33,
  build: 0.95,
  skin: "#d39b72",
  blush: 0.6,
  hair: "#2a1a12",
  hairSheen: "#8a6248",
  hairStyle: "long",
  iris: "#4a2a14",
  lip: "#b5605a",
  top: { kind: "tee", color: "#7fb7e6", accent: "#ffffff", sleeve: "short" },
  bottom: { color: "#3c4a6b", kind: "pants" },
  feet: { kind: "shoes", color: "#fafafa" },
};

/** Ibu — a mother in a hijab: older, softer build, long tunic. */
export const IBU: CharacterSpec = {
  ...RAKA,
  id: "ibu",
  scale: 0.86,
  headScale: 1.26,
  build: 1.1,
  skin: "#b98159",
  blush: 0.4,
  hair: "#2a2420",
  hairStyle: "hijab",
  scarf: "#6f8f6a",
  iris: "#3a2312",
  lip: "#9c564e",
  top: { kind: "shirt", color: "#c97b5a", accent: "#f3e3d3", sleeve: "long" },
  bottom: { color: "#4a3a32", kind: "skirt" },
  feet: { kind: "shoes", color: "#3a2e28" },
};

/** Ayah — a father: greying hair, moustache, glasses, batik-like shirt colour. */
export const AYAH: CharacterSpec = {
  ...RAKA,
  id: "ayah",
  scale: 0.95,
  headScale: 1.26,
  build: 1.1,
  skin: "#b07a55",
  blush: 0.35,
  hair: "#5a524c",
  hairSheen: "#a09890",
  hairStyle: "crop",
  brow: "#3a332e",
  iris: "#2a2a30",
  glasses: true,
  moustache: true,
  top: { kind: "shirt", color: "#8c5a3c", accent: "#f2d7a8", sleeve: "short" },
  bottom: { color: "#2f3340", kind: "pants" },
  feet: { kind: "shoes", color: "#2a2120" },
};

/** Adit — a teenager / school student: smaller, crop hair, white school shirt, grey trousers. */
export const ADIT: CharacterSpec = {
  ...RAKA,
  id: "adit",
  scale: 0.84,
  headScale: 1.4,
  build: 0.92,
  skin: "#c48a5e",
  blush: 0.55,
  hair: "#16100c",
  hairStyle: "swoop",
  iris: "#3a2312",
  top: { kind: "shirt", color: "#e3e1db", accent: "#7a8794", sleeve: "short" },
  bottom: { color: "#7a8794", kind: "pants" },
  feet: { kind: "shoes", color: "#1f1f22" },
};
