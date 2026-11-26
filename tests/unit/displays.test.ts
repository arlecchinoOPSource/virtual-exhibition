import { readFile } from 'node:fs/promises';
import { Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { createGallery } from '../../src/environments/gallery';
import { hangExhibits } from '../../src/exhibition/displays';
import { parseExhibits, sectionOf } from '../../src/exhibition/manifest';
import type { Exhibit } from '../../src/types/exhibit';

async function parseModel(name: 'gallery' | 'frame') {
  const file = await readFile(`public/models/${name}.glb`);
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  return (await new GLTFLoader().parseAsync(buffer, '')).scene;
}

async function setup() {
  const world = createGallery(
    await parseModel('gallery'),
    await parseModel('frame'),
  );
  // Upstairs entries only: the basement's three hang once it loads.
  const exhibits = parseExhibits(
    JSON.parse(await readFile('public/data/exhibits.json', 'utf8')),
  ).filter((exhibit) => sectionOf[exhibit.anchor] !== 'basement');
  return { world, exhibits };
}

describe('manifest-driven displays', () => {
  it('paints each anchor canvas with its own exhibit exactly once', async () => {
    const { world, exhibits } = await setup();
    const painted: [string, number][] = [];
    const displays = hangExhibits(world.anchors, exhibits, (exhibit, slot) => {
      painted.push([exhibit.anchor, slot]);
      return new Texture();
    });

    expect(painted).toEqual(
      exhibits.map((exhibit, index) => [exhibit.anchor, index + 1]),
    );
    for (const [index, anchor] of world.anchors.entries()) {
      const canvas = anchor.getObjectByName('Frame_Canvas');
      if (!(canvas instanceof Mesh)) throw new Error('Missing canvas.');
      const material = canvas.material as MeshStandardMaterial;
      expect(material.map?.flipY).toBe(false);
      expect(displays.exhibitAt(canvas)).toBe(exhibits[index]);
    }
    displays.dispose();
    world.dispose();
  });

  it('labels frames but not walls', async () => {
    const { world, exhibits } = await setup();
    const displays = hangExhibits(world.anchors, exhibits, () => new Texture());
    const moulding = world.anchors[6]?.getObjectByName('Frame_Moulding');
    expect(displays.exhibitAt(moulding)?.title).toBe('Artwork placeholder 7');
    const walls = world.scene.getObjectByName('Gallery_Walls');
    expect(walls).toBeDefined();
    expect(displays.exhibitAt(walls)).toBeUndefined();
    expect(displays.exhibitAt(undefined)).toBeUndefined();
    world.dispose();
  });

  it('rejects a manifest that leaves an anchor without an exhibit', async () => {
    const { world, exhibits } = await setup();
    const duplicated: Exhibit[] = exhibits.map((exhibit) =>
      exhibit.anchor === 'Exhibit_03'
        ? { ...exhibit, anchor: 'Exhibit_02' }
        : exhibit,
    );
    expect(() =>
      hangExhibits(world.anchors, duplicated, () => new Texture()),
    ).toThrow('Exhibit_02 must resolve to one free anchor.');
    world.dispose();
  });
});
