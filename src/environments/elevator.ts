import type { Box3, Object3D } from 'three';

// A beat after the walk starts, so the visitor sees the closed car first.
const DELAY_SECONDS = 0.6;
const SLIDE_SECONDS = 1.8;
// Each leaf slides its own width into the wall beside the doorway.
const TRAVEL = 0.9;
// The doorway lets the visitor out once the gap is half open (0.9 m).
const PASSABLE = 0.5;

export type ElevatorState = 'closed' | 'opening' | 'open';

// Slides the arrival elevator's two leaves apart along the wall and drops
// the doorway collider once the gap clears a visitor. The doors open once,
// when the walk starts, and then stay open.
export function createElevator(
  leaves: readonly Object3D[],
  collider: Box3,
  solids: Box3[],
) {
  let state: ElevatorState = 'closed';
  let clock = 0;
  const middle = (collider.min.z + collider.max.z) / 2;
  const starts = leaves.map((leaf) => leaf.position.z);
  // Each leaf moves away from the middle of the doorway.
  const away = starts.map((z) => Math.sign(z - middle));

  function step(seconds: number) {
    if (state !== 'opening') return;
    clock += seconds;
    const t = Math.min(1, Math.max(0, (clock - DELAY_SECONDS) / SLIDE_SECONDS));
    const eased = t * t * (3 - 2 * t);
    leaves.forEach((leaf, index) => {
      leaf.position.z = starts[index]! + away[index]! * TRAVEL * eased;
    });
    const index = solids.indexOf(collider);
    if (eased >= PASSABLE && index >= 0) solids.splice(index, 1);
    if (t === 1) state = 'open';
  }

  return {
    get state() {
      return state;
    },
    // Call when the walk starts; instant skips the slide (reduced motion).
    open(instant = false) {
      if (state !== 'closed') return;
      state = 'opening';
      clock = instant ? Infinity : 0;
      step(0);
    },
    update: step,
  };
}
