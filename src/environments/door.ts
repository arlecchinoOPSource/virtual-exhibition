import { Box3, Vector3 } from 'three';
import type { Object3D } from 'three';
import { PLAYER_RADIUS } from '../player/collision';

const OPEN_ANGLE = Math.PI / 2;
const SWING_SECONDS = 0.8;

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
  const doorway = collider.clone().expandByScalar(PLAYER_RADIUS);
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

// The exported leaves start open. The jamb pivots rotate in opposite
// directions and share one interaction, so the pair always moves together.
export function createRoomDoor(
  hinges: Object3D[],
  colliders: ReadonlyMap<string, Box3>,
  solids: Box3[],
) {
  const sweep = new Box3();
  const leaves = hinges.map((hinge) => {
    const name = `COL_${hinge.name}_Leaf`;
    const proxy = hinge.getObjectByName(name);
    const solid = colliders.get(name);
    const angle: unknown = hinge.userData.closesBy;
    if (!proxy || !solid || typeof angle !== 'number')
      throw new Error(`Invalid room door hinge: ${hinge.name}.`);

    const open = solid.clone();
    hinge.rotation.y = angle;
    hinge.updateMatrixWorld(true);
    const closed = new Box3().setFromObject(proxy);
    hinge.rotation.y = 0;
    hinge.updateMatrixWorld(true);
    sweep.union(open).union(closed);
    return { hinge, angle, solid, open, closed };
  });
  // Allow for the edge of a leaf extending slightly beyond the two end
  // poses mid-swing. Reserve the footprint only while the leaves are moving.
  sweep.expandByScalar(0.01);
  const clearance = sweep.clone().expandByScalar(PLAYER_RADIUS);
  const probe = new Vector3();
  const blocked = (feet: Vector3) =>
    clearance.containsPoint(probe.copy(feet).setY(feet.y + 1));

  let position = 0;
  let target = 0;
  return {
    label(feet: Vector3) {
      if (position !== target) return '';
      if (blocked(feet)) return 'Step back to clear the doors';
      return position === 0
        ? 'E / Click · Close the doors'
        : 'E / Click · Open the doors';
    },
    toggle(feet: Vector3) {
      if (position !== target || blocked(feet)) return;
      target = position === 0 ? 1 : 0;
      solids.push(sweep);
    },
    update(seconds: number) {
      if (position === target) return;
      const step = seconds / SWING_SECONDS;
      const remaining = target - position;
      position =
        Math.abs(remaining) <= step
          ? target
          : position + Math.sign(remaining) * step;
      for (const { hinge, angle } of leaves)
        hinge.rotation.y = angle * position;
      if (position !== target) return;
      for (const { solid, open, closed } of leaves)
        solid.copy(position === 0 ? open : closed);
      solids.splice(solids.indexOf(sweep), 1);
    },
  };
}
