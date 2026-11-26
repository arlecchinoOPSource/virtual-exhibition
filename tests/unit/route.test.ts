import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { createGallery } from '../../src/environments/gallery';
import { stepBody } from '../../src/player/collision';

// Walks the exported collision geometry along the accepted plan's routes
// (#86, #87): out of the arrival elevator, both loops through all five
// upstairs sections, every room corner, down the stairs to the basement and
// back up, and back into the elevator, at walking pace.

async function parseModel(name: 'gallery' | 'frame' | 'basement') {
  const file = await readFile(`public/models/${name}.glb`);
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  return (await new GLTFLoader().parseAsync(buffer, '')).scene;
}

const FPS = 120;
const SPEED = 3.2; // m/s, the visitor's walking speed
const BASEMENT_FLOOR = -3.06;

// Plan points in Blender (x, y). Upstairs legs stay at floor level. The
// basement legs are written in the basement's original frame (stairs running
// east from x 12 to 18) and placed by the plan's basement_transform.
type Leg = [label: string, x: number, y: number];
const { basement_transform: place } = JSON.parse(
  readFileSync('assets-source/layout/redesign.json', 'utf8'),
) as { basement_transform: { translate: number[]; rotate_z_deg: number } };
if (place.rotate_z_deg !== -90)
  throw new Error('These legs assume a quarter turn clockwise.');
const [tx = 0, ty = 0] = place.translate;
const placed = (legs: Leg[]): Leg[] =>
  legs.map(([label, x, y]) => [label, y + tx, ty - x]);

const northLoop: Leg[] = [
  ['out of the elevator', -13.0, 4.05],
  ['studio south-west corner', -13.7, 2.5],
  ['studio north-west corner', -13.7, 7.2],
  ['studio north-east corner', -7.0, 7.2],
  ['studio south-east corner', -7.0, 2.5],
  ['studio to street opening', -7.6, 5.5],
  ['street west end', -6.0, 5.5],
  ['street south-west corner', -6.2, 2.5],
  ['street south-east corner', 3.7, 2.5],
  ['street north-east corner', 3.7, 6.8],
  ['rear landing past the facades', 8.5, 6.8],
  ['rear landing north-east corner', 9.7, 7.2],
  ['rear landing south-east corner', 9.7, -1.7],
  ['rear landing west side', 4.3, -0.4],
  ['rear landing south-west corner', 4.3, -1.7],
  ['past the statue', 4.3, -0.4],
  ['basement door landing', 7.0, -0.9],
];
const basementLoop: Leg[] = placed([
  ['top of the stairs', 10.6, 0],
  ['foot of the stairs', 18.5, 0],
  ['basement north-west corner', 19.5, 3.7],
  ['basement north wall by the candles', 24.0, 3.7],
  ['basement north-east corner', 26.7, 3.7],
  ['basement middle', 24.0, 1.5],
  ['basement south wall', 24.0, -3.7],
  ['basement south-west corner', 19.5, -3.7],
  ['basement doorway', 19.5, 0],
  ['foot of the stairs, going up', 18.5, 0],
  ['top of the stairs, going up', 10.6, 0],
  ['back through the door', 9.0, 0],
]);
const reading: Leg[] = [
  ['reading east end', 3.7, 0],
  ['reading north-east corner', 3.7, 1.7],
  ['reading north-west', -7.7, 1.7],
  ['catalogue end of the band', -12.5, 0],
];
const southLoop: Leg[] = [
  ['living door', -11, 0],
  ['living door', -11, -3],
  ['living north-west corner', -13.7, -2.5],
  ['living south-west corner', -13.7, -8.7],
  ['living south-east corner', -3.4, -8.7],
  ['living north-east corner', -3.4, -2.5],
  ['living to theater opening', -3.4, -5.5],
  ['theater west side', -2.6, -5.5],
  ['theater south-west corner', -2.6, -8.7],
  ['theater south-east corner', 3.7, -8.7],
  ['theater north-east corner', 3.7, -2.5],
  ['theater north-west corner', -2.6, -2.5],
  ['theater door', 2.4, -2.5],
  ['reading area from the theater', 2.4, 0],
  ['catalogue end of the band', -12.5, 0],
  ['studio door', -11, 0],
  ['studio door', -11, 3.2],
  ['beside the elevator', -13.0, 4.05],
  ['back into the elevator', -15.5, 4.05],
];

describe('walking the accepted layout', () => {
  it('tours every section and the basement without trapping or falling', async () => {
    const world = createGallery(
      await parseModel('gallery'),
      await parseModel('frame'),
      () => parseModel('basement'),
    );
    const body = {
      feet: world.spawn.feet.clone(),
      grounded: true,
      fallSpeed: 0,
    };
    const lowest = { y: 0 };

    // Steers straight at each point; the leg fails if the visitor is stuck.
    const walk = (legs: Leg[]) => {
      for (const [label, x, y] of legs) {
        const target = new Vector3(x, 0, -y);
        let frames = 0;
        for (; frames < FPS * 20; frames++) {
          const dx = target.x - body.feet.x;
          const dz = target.z - body.feet.z;
          const distance = Math.hypot(dx, dz);
          if (distance < 0.05) break;
          const step = Math.min(distance, SPEED / FPS) / distance;
          stepBody(body, dx * step, dz * step, 1 / FPS, world.solids);
          lowest.y = Math.min(lowest.y, body.feet.y);
          // Outside the stairwell (x 6 to 8, south of the doorway) and the
          // basement room, the floor never gives way.
          const below =
            (body.feet.x > 6 && body.feet.x < 8 && body.feet.z > 2.2) ||
            body.feet.z > 11;
          if (!below) expect(body.feet.y, label).toBeCloseTo(0, 3);
        }
        const reached = Math.hypot(
          target.x - body.feet.x,
          target.z - body.feet.z,
        );
        expect(reached, `stuck before ${label}`).toBeLessThan(0.05);
        // Settle, then check the visitor stands on a floor.
        for (let i = 0; i < FPS / 4; i++)
          stepBody(body, 0, 0, 1 / FPS, world.solids);
        expect(body.grounded, label).toBe(true);
      }
    };

    // The walk starts; the elevator doors slide open onto the gallery.
    world.elevator.open();
    for (let t = 0; t < 2.5; t += 1 / FPS) world.update(1 / FPS);
    expect(world.elevator.state).toBe('open');
    walk(northLoop);
    await world.door.toggle(body.feet);
    for (let t = 0; t < 1.2; t += 1 / FPS) world.update(1 / FPS);
    expect(world.door.state).toBe('open');
    walk(basementLoop.slice(0, 2));
    expect(body.feet.y).toBeCloseTo(BASEMENT_FLOOR, 2);
    walk(basementLoop.slice(2));
    expect(body.feet.y).toBeCloseTo(0, 3);
    expect(lowest.y).toBeGreaterThan(BASEMENT_FLOOR - 0.01);
    walk(reading);
    walk(southLoop);
    expect(body.feet.distanceTo(world.spawn.feet)).toBeLessThan(0.05);
    world.dispose();
  });
});
