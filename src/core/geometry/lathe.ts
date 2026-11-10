// Turned parts (lenses, knobs, dials, bottles, columns): a profile of [radius, height] pairs
// revolved around +y. Profiles are unit-sized — scale the mesh to the part's real size, so one
// geometry can be reused and resized every frame without rebuilding.

import { LatheGeometry, Vector2 } from "three";

export const lathe = (profile: [number, number][], segments = 64) => new LatheGeometry(profile.map(([r, y]) => new Vector2(Math.max(r, 1e-4), y)), segments);

/** A common one: barrel with a bevelled lip and a recessed face (lens, knob, dial). */
export const BARREL: [number, number][] = [[0, 0], [1, 0], [1, 0.9], [0.92, 1], [0.7, 1], [0.66, 0.96], [0, 0.96]];
