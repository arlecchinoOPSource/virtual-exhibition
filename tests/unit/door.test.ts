import { readFile } from 'node:fs/promises';
import {
  Box3,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  Raycaster,
  Vector3,
} from 'three';
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
      (box) =>
        box.containsPoint(new Vector3(10.1, 1.2, 0)) &&
        box.max.y > 2 &&
        box.max.y < 2.5,
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

describe('basement room', () => {
  async function openBasement() {
    const world = await loadWorld();
    await world.door.toggle(outside);
    world.passes[0]!.updateMatrixWorld(true);
    return world;
  }

  it('furnishes the room with the specified original props and lights', async () => {
    const world = await openBasement();
    const find = (name: string) => world.passes[0]!.getObjectByName(name);
    for (const name of [
      'Basement_Throne',
      'Basement_Throne_Cloth',
      'Basement_Candle_Stand',
      'Basement_Candles',
      'Basement_Bulb_Cords',
      'Bulb_Room',
      'Bulb_Stairs',
      'Basement_Walls',
      'Basement_Shell',
    ])
      expect(find(name), name).toBeDefined();
    const graffiti = find('Graffiti_Black_Metal');
    expect(graffiti?.userData.text).toBe('BLACK METAL');
    // Painted on the east wall, facing back toward the doorway.
    const bounds = new Box3().setFromObject(graffiti!);
    expect(bounds.max.x).toBeLessThanOrEqual(27);
    expect(bounds.min.x).toBeGreaterThan(26.9);
    // Set beside the throne, not above it.
    const throne = new Box3().setFromObject(find('Basement_Throne')!);
    expect(bounds.min.z).toBeGreaterThan(throne.max.z + 0.3);
    const lights: string[] = [];
    world.passes[0]!.traverse((node) => {
      if (node instanceof PointLight) lights.push(node.name);
    });
    // The basement draws in its own pass, so its bulbs never join the
    // gallery's light set (which would rebuild every gallery shader).
    const galleryPoints: string[] = [];
    world.scene.traverse((node) => {
      if (node instanceof PointLight) galleryPoints.push(node.name);
    });
    expect(galleryPoints).toEqual(['Light_Entrance_Torch']);
    expect(lights.sort()).toEqual([
      'Light_Basement_Bulb_Room',
      'Light_Basement_Bulb_Stairs',
      'Light_Basement_Candles',
    ]);
    world.dispose();
  });

  it('pastes the two historical prints on the side walls, each in its own slot', async () => {
    const world = await openBasement();
    const find = (name: string) =>
      world.passes[0]!.getObjectByName(name) as Mesh | undefined;
    const throne = new Box3().setFromObject(find('Basement_Throne')!);
    const materials = new Set<MeshStandardMaterial>();
    for (const [name, artwork, wallZ, aspect] of [
      // Sheet aspect = artwork pixels plus the paper margin on every side.
      [
        'Poster_Kittelsen_Lur',
        'kittelsen-op-under-fjeldet-toner-en-lur.webp',
        -4,
        804 / 600,
      ],
      [
        'Poster_Dore_Pale_Horse',
        'dore-death-on-the-pale-horse.jpg',
        4,
        822 / 1019,
      ],
    ] as const) {
      const poster = find(name);
      expect(poster?.userData.artwork, name).toBe(artwork);
      const bounds = new Box3().setFromObject(poster!);
      // Off the wall but close to it: no z-fighting, no floating sheet.
      const gap = Math.min(
        ...[bounds.min.z, bounds.max.z].map((z) => Math.abs(z - wallZ)),
      );
      expect(gap, name).toBeGreaterThan(0.003);
      expect(Math.abs(bounds.max.z - bounds.min.z), name).toBeLessThan(0.05);
      const size = bounds.getSize(new Vector3());
      expect(size.x / size.y, name).toBeCloseTo(aspect, 2);
      // Clear of the throne's end of the room.
      expect(bounds.max.x, name).toBeLessThan(throne.min.x - 1);
      // Each print has its own material, so one can be replaced alone.
      const material = poster!.material as MeshStandardMaterial;
      expect(material.name, name).toBe(`${name}_Print`);
      materials.add(material);
    }
    expect(materials.size).toBe(2);
    world.dispose();
  });

  it('models the radio with the named parts that playback (#61) binds to', async () => {
    const world = await openBasement();
    const find = (name: string) =>
      world.passes[0]!.getObjectByName(name) as Mesh | undefined;
    const root = find('Radio_Basement')!;
    const parts = [
      'Power',
      'Emitter',
      'Status',
      'Dial',
      'Knob_Volume',
      'Knob_Tuning',
    ].map((part) => {
      const node = find(`Radio_Basement_${part}`);
      expect(node, part).toBeDefined();
      expect(node!.parent, part).toBe(root);
      return node!;
    });
    // Status lamp and dial own their materials, so lighting one changes nothing else.
    for (const [name, material] of [
      ['Radio_Basement_Status', 'Radio_Status_Lamp'],
      ['Radio_Basement_Dial', 'Radio_Dial_Face'],
    ]) {
      const users: string[] = [];
      world.passes[0]!.traverse((node) => {
        if (
          node instanceof Mesh &&
          (node.material as MeshStandardMaterial).name === material
        )
          users.push(node.name);
      });
      expect(users).toEqual([name]);
    }
    // Knobs and the switch turn in place: their shafts run along local Z.
    for (const name of [
      'Radio_Basement_Knob_Volume',
      'Radio_Basement_Knob_Tuning',
      'Radio_Basement_Power',
    ]) {
      const box = find(name)!.geometry.boundingBox!;
      expect(Math.abs(box.min.x + box.max.x) / 2, name).toBeLessThan(0.01);
      expect(Math.abs(box.min.y + box.max.y) / 2, name).toBeLessThan(0.01);
    }
    // In the south-east corner, clear of the throne and walking route.
    const [power, emitter] = parts;
    const at = emitter!.getWorldPosition(new Vector3());
    expect(at.x).toBeGreaterThan(26);
    expect(at.z).toBeGreaterThan(3);
    expect(
      world.solids.some((box) =>
        box.containsPoint(new Vector3(26.6, -2.7, 3.68)),
      ),
    ).toBe(true);
    // The switch is the first surface a visitor's ray meets from the front.
    const front = new Vector3(0, 0, 1).applyQuaternion(
      root.getWorldQuaternion(new Quaternion()),
    );
    const target = power!.getWorldPosition(new Vector3());
    const ray = new Raycaster(
      target.clone().addScaledVector(front, 1.5),
      front.clone().negate(),
      0,
      3,
    );
    expect(ray.intersectObjects(world.surfaces, false)[0]?.object).toBe(power);
    world.dispose();
  });

  it('bakes weathered PBR atlases into the on-demand basement export', async () => {
    const file = await readFile('public/models/basement.glb');
    // Budget for the deferred basement, separate from the initial gallery load.
    expect(file.byteLength).toBeLessThan(1.5e6);
    const json = JSON.parse(
      file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'),
    ) as {
      images: { name: string; mimeType: string; bufferView: number }[];
      textures: { source: number }[];
      bufferViews: { byteOffset?: number; byteLength: number }[];
      materials: {
        name: string;
        normalTexture?: object;
        pbrMetallicRoughness?: {
          baseColorTexture?: object;
          metallicRoughnessTexture?: object;
        };
      }[];
    };
    for (const name of ['Basement_Plaster', 'Basement_Concrete']) {
      const material = json.materials.find((entry) => entry.name === name);
      expect(
        material?.pbrMetallicRoughness?.baseColorTexture,
        name,
      ).toBeDefined();
      expect(
        material?.pbrMetallicRoughness?.metallicRoughnessTexture,
        name,
      ).toBeDefined();
      expect(material?.normalTexture, name).toBeDefined();
    }
    // Each print material samples its own image, named after its poster.
    for (const name of ['Poster_Kittelsen_Lur', 'Poster_Dore_Pale_Horse']) {
      const material = json.materials.find(
        (entry) => entry.name === `${name}_Print`,
      );
      const texture = material?.pbrMetallicRoughness?.baseColorTexture as
        { index: number } | undefined;
      const image = json.images[json.textures[texture!.index]!.source]!;
      expect(image.name, name).toBe(`${name} - print`);
    }
    const binary = 20 + file.readUInt32LE(12) + 8;
    for (const image of json.images) {
      // Only the graffiti decal needs alpha, and it ships as PNG.
      if (image.name.startsWith('Graffiti_Black_Metal')) {
        expect(image.mimeType).toBe('image/png');
        continue;
      }
      expect(image.mimeType).toBe('image/jpeg');
      const view = json.bufferViews[image.bufferView]!;
      const jpeg = file.subarray(binary + (view.byteOffset ?? 0));
      // Read the frame size from the first SOF marker.
      let offset = 2;
      while (jpeg[offset + 1] !== 0xc0 && jpeg[offset + 1] !== 0xc2)
        offset += 2 + jpeg.readUInt16BE(offset + 2);
      const height = jpeg.readUInt16BE(offset + 5);
      const width = jpeg.readUInt16BE(offset + 7);
      expect(Math.max(width, height)).toBeLessThanOrEqual(2048);
    }
  });

  it('lets a visitor cross the room until the throne stops them', async () => {
    const world = await openBasement();
    const body = {
      feet: new Vector3(17.5, -3.06, 0),
      grounded: true,
      fallSpeed: 0,
    };
    for (let frame = 0; frame < 600; frame++)
      stepBody(body, 3.2 / 120, 0, 1 / 120, world.solids);
    expect(body.feet.x).toBeCloseTo(25.61, 1);
    expect(body.feet.y).toBeCloseTo(-3.06, 1);
    world.dispose();
  });

  it('fades daylight below ground and restores it upstairs', async () => {
    const world = await openBasement();
    // The fade follows the same curve, with independent light levels.
    const skies: HemisphereLight[] = [];
    for (const root of [world.scene, world.passes[0]!])
      root.traverse((node) => {
        if (node instanceof HemisphereLight) skies.push(node);
      });
    expect(skies).toHaveLength(2);
    for (let t = 0; t < 4; t += 1 / 60)
      world.update(1 / 60, new Vector3(22, -3.06, 0));
    expect(skies[0]?.intensity).toBeLessThan(0.05);
    expect(skies[1]?.intensity).toBeLessThan(0.025);
    for (let t = 0; t < 4; t += 1 / 60) world.update(1 / 60, outside);
    expect(skies[0]?.intensity).toBeCloseTo(0.42, 2);
    expect(skies[1]?.intensity).toBeCloseTo(0.2, 2);
    world.dispose();
  });
});
