import { readFile } from 'node:fs/promises';
import { Euler, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { createGallery } from '../../src/environments/gallery';
import { stepBody } from '../../src/player/collision';

async function parseGallery() {
  const file = await readFile('public/models/gallery.glb');
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  return (await new GLTFLoader().parseAsync(buffer, '')).scene;
}

describe('gallery blockout', () => {
  it('spawns at the left end facing down the gallery', async () => {
    const world = createGallery(await parseGallery());
    expect(world.spawn.feet.x).toBeCloseTo(-8.5);
    expect(world.spawn.feet.y).toBeCloseTo(0);
    expect(world.spawn.feet.z).toBeCloseTo(0);
    const gaze = new Vector3(0, 0, -1).applyEuler(
      new Euler(0, world.spawn.yaw, 0),
    );
    expect(gaze.x).toBeCloseTo(1);
    world.dispose();
  });

  it('places twelve anchors on display surfaces facing open floor', async () => {
    const world = createGallery(await parseGallery());
    expect(world.anchors.map((anchor) => anchor.name)).toEqual(
      Array.from(
        { length: 12 },
        (_, index) => `Exhibit_${String(index + 1).padStart(2, '0')}`,
      ),
    );
    const isSolid = (point: Vector3) =>
      world.solids.some((box) => box.containsPoint(point));

    for (const anchor of world.anchors) {
      const position = anchor.getWorldPosition(new Vector3());
      const outward = new Vector3(0, 0, 1).applyQuaternion(
        anchor.getWorldQuaternion(new Quaternion()),
      );
      expect(outward.y, anchor.name).toBeCloseTo(0);
      expect(isSolid(position.clone().addScaledVector(outward, -0.05))).toBe(
        true,
      );
      const viewpoint = position.clone().addScaledVector(outward, 1);
      expect(isSolid(viewpoint), anchor.name).toBe(false);
      expect(Math.abs(viewpoint.x), anchor.name).toBeLessThan(10);
      expect(Math.abs(viewpoint.z), anchor.name).toBeLessThan(5);
    }
    world.dispose();
  });

  it('blocks walls and islands and reaches both ends', async () => {
    const world = createGallery(await parseGallery());
    const body = {
      feet: world.spawn.feet.clone(),
      grounded: true,
      fallSpeed: 0,
    };
    const walk = (dx: number, dz: number) => {
      for (let count = 0; count < 1000; count++)
        stepBody(body, dx, dz, 1 / 120, world.solids);
    };

    walk(0.025, 0);
    expect(body.feet.x).toBeCloseTo(-5.74, 1);
    walk(-0.025, 0);
    expect(body.feet.x).toBeCloseTo(-9.76, 1);
    walk(0, 0.025);
    expect(body.feet.z).toBeCloseTo(4.76, 1);
    // The walkway between the islands and the south piers runs the full length.
    body.feet.z = 2.5;
    walk(0.025, 0);
    expect(body.feet.x).toBeCloseTo(9.76, 1);
    body.feet.z = 0;
    walk(0.025, 0);
    expect(body.feet.x).toBeCloseTo(9.96, 1);
    expect(body.feet.y).toBeCloseTo(0);
    world.dispose();
  });

  it('rejects an export with a missing anchor', async () => {
    const root = await parseGallery();
    root.getObjectByName('Exhibit_05')?.removeFromParent();
    expect(() => createGallery(root)).toThrow('exactly one Exhibit_05');
  });
});
