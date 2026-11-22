import { Vector3 } from 'three';
import type { Box3, Object3D } from 'three';

const OPEN_ANGLE = Math.PI / 2;
const SWING_SECONDS = 0.8;
// Matches the player radius so a visitor in the doorway counts as blocking it.
const CLEARANCE = 0.24;

export type DoorState = 'closed' | 'loading' | 'opening' | 'open' | 'closing';

// Swings the basement door on its hinge and keeps its collider in step: the
// collider is solid whenever the door is closed, loading, or closing.
export function createDoor(
  hinge: Object3D,
  collider: Box3,
  solids: Box3[],
  prepare: () => Promise<void>,
) {
  let state: DoorState = 'closed';
  let failed = false;
  const doorway = collider.clone().expandByScalar(CLEARANCE);
  const probe = new Vector3();

  function setSolid(solid: boolean) {
    const index = solids.indexOf(collider);
    if (solid && index < 0) solids.push(collider);
    if (!solid && index >= 0) solids.splice(index, 1);
  }

  function inDoorway(feet: Vector3) {
    return doorway.containsPoint(probe.copy(feet).setY(feet.y + 1));
  }

  return {
    get state() {
      return state;
    },
    label(feet: Vector3) {
      if (state === 'closed')
        return failed
          ? 'The basement could not be loaded · E / Click to try again'
          : 'E / Click · Open the door';
      if (state === 'loading') return 'Opening the basement…';
      if (state === 'open')
        return inDoorway(feet)
          ? 'Step clear of the doorway to close the door'
          : 'E / Click · Close the door';
      return '';
    },
    async toggle(feet: Vector3) {
      if (state === 'open' && !inDoorway(feet)) {
        setSolid(true);
        state = 'closing';
        return;
      }
      if (state !== 'closed') return;
      state = 'loading';
      try {
        await prepare();
        failed = false;
        setSolid(false);
        state = 'opening';
      } catch (error) {
        console.error('The basement could not be loaded.', error);
        // The door stays shut, so the gallery remains usable.
        failed = true;
        state = 'closed';
      }
    },
    update(seconds: number) {
      const step = (OPEN_ANGLE / SWING_SECONDS) * seconds;
      if (state === 'opening') {
        hinge.rotation.y = Math.min(OPEN_ANGLE, hinge.rotation.y + step);
        if (hinge.rotation.y === OPEN_ANGLE) state = 'open';
      } else if (state === 'closing') {
        hinge.rotation.y = Math.max(0, hinge.rotation.y - step);
        if (hinge.rotation.y === 0) state = 'closed';
      }
    },
  };
}
