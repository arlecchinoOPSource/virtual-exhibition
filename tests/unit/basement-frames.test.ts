import { readFile } from 'node:fs/promises';
import { Group, Mesh, SpotLight, Texture, Vector3 } from 'three';
import type { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { createGallery } from '../../src/environments/gallery';
import { hangExhibits } from '../../src/exhibition/displays';
import { parseExhibits, sectionOf } from '../../src/exhibition/manifest';

// The basement's three frames (#88) attach only once basement.glb loads, and
// a load happens once however often the door opens.

async function parseModel(name: 'gallery' | 'frame' | 'basement') {
  const file = await readFile(`public/models/${name}.glb`);
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  return (await new GLTFLoader().parseAsync(buffer, '')).scene;
}

const outside = new Vector3(7, 0, 0);

async function setup(load: () => Promise<Object3D>) {
  const hung: string[][] = [];
  const world = createGallery(
    await parseModel('gallery'),
    await parseModel('frame'),
    load,
    (anchors) => hung.push(anchors.map((anchor) => anchor.name)),
  );
  const cycle = async () => {
    await world.door.toggle(outside);
    for (let t = 0; t < 1; t += 1 / 60) world.update(1 / 60);
  };
  const close = () => {
    void world.door.toggle(outside);
    for (let t = 0; t < 1; t += 1 / 60) world.update(1 / 60);
  };
  return { world, hung, cycle, close };
}

const count = (root: Object3D, name: string) => {
  let found = 0;
  root.traverse((node) => {
    if (node.name === name) found++;
  });
  return found;
};

describe('basement frames', () => {
  it('attach after the basement loads, once, however often the door opens', async () => {
    const load = vi.fn(() => parseModel('basement'));
    const { world, hung, cycle, close } = await setup(load);
    expect(count(world.scene, 'Exhibit_16')).toBe(0);
    expect(load).not.toHaveBeenCalled();
    expect(hung).toEqual([]);

    await cycle();
    expect(world.door.state).toBe('open');
    expect(hung).toEqual([['Exhibit_16', 'Exhibit_17', 'Exhibit_18']]);
    const downstairs = world.passes[0]!;
    for (const name of ['Exhibit_16', 'Exhibit_17', 'Exhibit_18']) {
      const anchor = downstairs.getObjectByName(name)!;
      expect(count(anchor, 'Frame_Canvas'), name).toBe(1);
      // The canvas joins the occlusion-aware picker's surfaces.
      const canvas = anchor.getObjectByName('Frame_Canvas') as Mesh;
      expect(world.surfaces).toContain(canvas);
    }

    close();
    expect(world.door.state).toBe('closed');
    await cycle();
    expect(world.door.state).toBe('open');
    expect(load).toHaveBeenCalledTimes(1);
    expect(hung).toHaveLength(1);
    expect(count(downstairs, 'Exhibit_16')).toBe(1);
    expect(count(downstairs, 'Frame_Canvas')).toBe(3);
    world.dispose();
  });

  it('retry after a failed load and attach the frames only then', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const load = vi
      .fn<() => Promise<Object3D>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(() => parseModel('basement'));
    const { world, hung, cycle } = await setup(load);
    await world.door.toggle(outside);
    expect(world.door.state).toBe('closed');
    expect(hung).toEqual([]);
    await cycle();
    expect(world.door.state).toBe('open');
    expect(hung).toHaveLength(1);
    expect(count(world.passes[0]!, 'Frame_Canvas')).toBe(3);
    error.mockRestore();
    world.dispose();
  });

  it('refuse a basement with a missing or misassigned slot and free it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const [change, message] of [
      [
        (root: Object3D) =>
          root.getObjectByName('Exhibit_17')!.removeFromParent(),
        'The basement is missing Exhibit_17.',
      ],
      [
        (root: Object3D) => {
          const stray = new Group();
          stray.name = 'Exhibit_05';
          root.add(stray);
        },
        'Exhibit_05 does not belong in the basement.',
      ],
    ] as const) {
      const basement = await parseModel('basement');
      change(basement);
      let mesh: Mesh | undefined;
      basement.traverse((node) => {
        if (!mesh && node instanceof Mesh) mesh = node;
      });
      const freed = vi.spyOn(mesh!.geometry, 'dispose');
      const { world, hung } = await setup(async () => basement);
      await world.door.toggle(outside);
      expect(world.door.state).toBe('closed');
      expect(hung).toEqual([]);
      expect(world.passes[0]!.getObjectByName('Exhibit_16')).toBeUndefined();
      expect(error.mock.calls.at(-1)?.[1]).toEqual(new Error(message));
      expect(freed).toHaveBeenCalled();
      world.dispose();
    }
    error.mockRestore();
  });

  it('drop a basement that arrives after the world is disposed', async () => {
    let arrive: (root: Object3D) => void = () => {};
    const { world, hung } = await setup(
      () => new Promise<Object3D>((done) => (arrive = done)),
    );
    const opening = world.door.toggle(outside);
    world.dispose();
    arrive(await parseModel('basement'));
    await opening;
    expect(hung).toEqual([]);
    expect(world.passes[0]!.getObjectByName('Exhibit_16')).toBeUndefined();
  });

  it('light each basement frame with its own warm picture light', async () => {
    const basement = await parseModel('basement');
    basement.updateMatrixWorld(true);
    const spots: SpotLight[] = [];
    basement.traverse((node) => {
      if (node instanceof SpotLight) spots.push(node);
    });
    expect(spots).toHaveLength(3);
    for (const slot of ['Exhibit_16', 'Exhibit_17', 'Exhibit_18']) {
      const anchor = basement.getObjectByName(slot);
      if (!anchor) throw new Error(`Missing ${slot}.`);
      const target = anchor.getWorldPosition(new Vector3());
      const aimed = spots.filter((spot) => {
        const origin = spot.getWorldPosition(new Vector3());
        const direction = spot.target
          .getWorldPosition(new Vector3())
          .sub(origin)
          .normalize();
        const offset = target.clone().sub(origin);
        const along = offset.dot(direction);
        return (
          along > 0 &&
          offset.addScaledVector(direction, -along).length() < 0.1 &&
          origin.y > target.y
        );
      });
      expect(aimed, slot).toHaveLength(1);
      // Warm, like the bulbs: more red than blue.
      expect(aimed[0]!.color.r).toBeGreaterThan(aimed[0]!.color.b);
    }
  });

  it('look up basement exhibits alongside the gallery ones', async () => {
    const exhibits = parseExhibits(
      JSON.parse(await readFile('public/data/exhibits.json', 'utf8')),
    );
    const downstairs = exhibits.filter(
      (exhibit) => sectionOf[exhibit.anchor] === 'basement',
    );
    let displays: ReturnType<typeof hangExhibits> | undefined;
    const world = createGallery(
      await parseModel('gallery'),
      await parseModel('frame'),
      () => parseModel('basement'),
      (anchors) => {
        displays = hangExhibits(anchors, downstairs, () => new Texture());
      },
    );
    await world.door.toggle(outside);
    const canvas =
      world.passes[0]!.getObjectByName('Exhibit_17')!.getObjectByName(
        'Frame_Canvas',
      );
    expect(displays?.exhibitAt(canvas)?.title).toBe('Artwork placeholder 17');
    displays?.dispose();
    world.dispose();
  });
});
