import type { Box3, Vector3 } from 'three';

const RADIUS = 0.24;
const HEIGHT = 1.78;
const MAX_STEP = 0.22;
const GRAVITY = 9.81;

export interface PlayerBody {
  feet: Vector3;
  fallSpeed: number;
  grounded: boolean;
}

function overlapsFootprint(box: Box3, x: number, z: number) {
  return (
    x + RADIUS > box.min.x &&
    x - RADIUS < box.max.x &&
    z + RADIUS > box.min.z &&
    z - RADIUS < box.max.z
  );
}

function moveAxis(
  body: PlayerBody,
  axis: 'x' | 'z',
  distance: number,
  solids: readonly Box3[],
) {
  if (distance === 0) return;
  const { feet } = body;
  const x = feet.x + (axis === 'x' ? distance : 0);
  const z = feet.z + (axis === 'z' ? distance : 0);
  let candidateY = feet.y;

  for (const box of solids) {
    if (
      overlapsFootprint(box, x, z) &&
      feet.y < box.max.y &&
      feet.y + HEIGHT > box.min.y
    ) {
      if (!body.grounded || box.max.y - feet.y > MAX_STEP) return;
      candidateY = Math.max(candidateY, box.max.y);
    }
  }

  // Check headroom for the climb, including solids above the original head height.
  if (
    candidateY > feet.y &&
    solids.some(
      (box) =>
        overlapsFootprint(box, x, z) &&
        candidateY < box.max.y &&
        candidateY + HEIGHT > box.min.y,
    )
  ) {
    return;
  }

  feet.set(x, candidateY, z);
}

export function stepBody(
  body: PlayerBody,
  dx: number,
  dz: number,
  dt: number,
  solids: readonly Box3[],
) {
  // Split the axes so a blocked component still allows motion along the wall.
  moveAxis(body, 'x', dx, solids);
  moveAxis(body, 'z', dz, solids);

  const { feet } = body;
  body.fallSpeed += GRAVITY * dt;
  const nextY = feet.y - body.fallSpeed * dt;
  let support = -Infinity;
  for (const box of solids) {
    if (
      box.max.y <= feet.y &&
      box.max.y >= nextY &&
      overlapsFootprint(box, feet.x, feet.z)
    ) {
      support = Math.max(support, box.max.y);
    }
  }
  body.grounded = support > -Infinity;
  feet.y = body.grounded ? support : nextY;
  if (body.grounded) body.fallSpeed = 0;
}
