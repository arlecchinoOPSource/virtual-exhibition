import { readFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { createGallery } from '../../src/environments/gallery';
import { stepBody } from '../../src/player/collision';

async function parseModel(name: 'gallery' | 'frame' | 'basement') {
  const file = await readFile(`public/models/${name}.glb`);
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  return (await new GLTFLoader().parseAsync(buffer, '')).scene;
}

async function loadWorld(loadBasement = () => parseModel('basement')) {
  return createGallery(
    await parseModel('gallery'),
    await parseModel('frame'),
    loadBasement,
  );
}

const outside = new Vector3(8, 0, 0);

describe('basement door', () => {
  it('swings into the basement and keeps its collider in sync', async () => {
    const world = await loadWorld();
    const collider = world.solids.find(
      (box) => box.min.x > 10 && box.max.x < 10.2 && box.max.y > 2,
    );
    if (!collider) throw new Error('Missing door collider.');
    const solidWhen = new Set(['closed', 'loading', 'closing']);
    const inSync = () =>
      world.solids.includes(collider) === solidWhen.has(world.door.state);
    const swing = (seconds: number) => {
      for (let t = 0; t < seconds; t += 1 / 120) {
        world.update(1 / 120);
        expect(inSync()).toBe(true);
      }
    };

    expect(world.door.state).toBe('closed');
    const opening = world.door.toggle(outside);
    expect(world.door.state).toBe('loading');
    expect(inSync()).toBe(true);
    await opening;
    expect(world.door.state).toBe('opening');
    // Repeated input mid-swing is ignored.
    await world.door.toggle(outside);
    swing(1);
    expect(world.door.state).toBe('open');
    world.scene.updateMatrixWorld(true);
    const door = world.scene.getObjectByName('Door_Basement');
    expect(new Box3().setFromObject(door!).max.x).toBeGreaterThan(11.5);

    await world.door.toggle(outside);
    expect(world.door.state).toBe('closing');
    await world.door.toggle(outside);
    swing(1);
    expect(world.door.state).toBe('closed');
    expect(world.solids.includes(collider)).toBe(true);
    world.dispose();
  });

  it('will not close on a visitor standing in the doorway', async () => {
    const world = await loadWorld();
    await world.door.toggle(outside);
    for (let t = 0; t < 1; t += 1 / 60) world.update(1 / 60);
    const doorway = new Vector3(10.1, 0, 0);
    expect(world.door.label(doorway)).toMatch(/Step clear/);
    await world.door.toggle(doorway);
    expect(world.door.state).toBe('open');
    world.dispose();
  });

  it('stays closed and solid when the basement fails to load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const world = await loadWorld(() => Promise.reject(new Error('offline')));
    const solids = world.solids.length;
    await world.door.toggle(outside);
    expect(world.door.state).toBe('closed');
    expect(world.solids).toHaveLength(solids);
    expect(world.door.label(outside)).toMatch(/could not be loaded/);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    world.dispose();
  });
});

describe('basement stairs', () => {
  it.each([30, 60, 144])(
    'descend to the lower landing and climb back at %i fps',
    async (fps) => {
      const world = await loadWorld();
      await world.door.toggle(outside);
      const body = {
        feet: new Vector3(9.5, 0, 0),
        grounded: true,
        fallSpeed: 0,
      };
      const walk = (dx: number, seconds: number) => {
        for (let frame = 0; frame < seconds * fps; frame++)
          stepBody(body, (dx * 3.2) / fps, 0, 1 / fps, world.solids);
      };
      walk(1, 4);
      expect(body.feet.x).toBeGreaterThan(17.1);
      expect(body.feet.y).toBeCloseTo(-3.06, 1);
      expect(body.grounded).toBe(true);
      walk(-1, 4);
      expect(body.feet.x).toBeLessThan(10);
      expect(body.feet.y).toBeCloseTo(0);
      expect(body.grounded).toBe(true);
      world.dispose();
    },
  );
});
