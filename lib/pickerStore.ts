import type { Place } from "./types";

/** Tiny hand-off so the location picker modal can return a result to its caller. */
type Listener = (p: Place) => void;
let listener: Listener | null = null;

export const locationPicker = {
  open(onPick: Listener) { listener = onPick; },
  resolve(p: Place) { listener?.(p); listener = null; },
  cancel() { listener = null; },
};
