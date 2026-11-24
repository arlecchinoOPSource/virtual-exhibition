import { readFile, stat } from 'node:fs/promises';
import {
  Box3,
  Euler,
  Group,
  Mesh,
  Quaternion,
  PerspectiveCamera,
  SpotLight,
  Texture,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { createGallery } from '../../src/environments/gallery';
import { createSurfacePicker } from '../../src/player/interaction';
import { stepBody } from '../../src/player/collision';

async function parseModel(name: 'gallery' | 'frame') {
  const file = await readFile(`public/models/${name}.glb`);
  const buffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  return (await new GLTFLoader().parseAsync(buffer, '')).scene;
}

async function loadWorld() {
  return createGallery(await parseModel('gallery'), await parseModel('frame'));
}

describe('gallery blockout', () => {
  it('spawns at the left end facing down the gallery', async () => {
    const world = await loadWorld();
    expect(world.spawn.feet.x).toBeCloseTo(-8.5);
    expect(world.spawn.feet.y).toBeCloseTo(0);
    expect(world.spawn.feet.z).toBeCloseTo(0);
    const gaze = new Vector3(0, 0, -1).applyEuler(
      new Euler(0, world.spawn.yaw, 0),
    );
    expect(gaze.x).toBeCloseTo(1);
    world.dispose();
  });

  it('places fifteen anchors on display surfaces facing open floor', async () => {
    const world = await loadWorld();
    expect(world.anchors.map((anchor) => anchor.name)).toEqual(
      Array.from(
        { length: 15 },
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

  it('replaces the partition with a compact collision proxy and actionable catalogue', async () => {
    const world = await loadWorld();
    expect(world.scene.getObjectByName('COL_Partition_Center')).toBeUndefined();
    const proxy = world.scene.getObjectByName('COL_Lectern_Clearance');
    expect(proxy).toBeDefined();
    expect(
      world.solids.some((box) => box.containsPoint(new Vector3(0, 0.5, 0))),
    ).toBe(true);
    for (const side of [-1, 1]) {
      expect(
        world.solids.some((box) =>
          box.containsPoint(new Vector3(0, 0.5, side * 1.5)),
        ),
      ).toBe(false);
    }
    expect(
      world.isCatalogue(world.scene.getObjectByName('Catalogue_Pages')),
    ).toBe(true);
    const camera = new PerspectiveCamera();
    camera.position.set(-1.65, 1.65, 0);
    camera.lookAt(0, 1.15, 0.07);
    const pick = createSurfacePicker(camera, world.surfaces, 3);
    expect(world.isCatalogue(pick())).toBe(true);
    camera.position.x = -4.5;
    camera.lookAt(0, 1.15, 0.07);
    expect(world.isCatalogue(pick())).toBe(false);
    expect(world.isCatalogue(undefined)).toBe(false);
    expect(world.anchors.every((anchor) => anchor.children.length === 1)).toBe(
      true,
    );
    world.dispose();
  });

  it('blocks walls and islands and reaches both ends', async () => {
    const world = await loadWorld();
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
    // The closed basement door stops the visitor in the doorway.
    body.feet.z = 0;
    walk(0.025, 0);
    expect(body.feet.x).toBeCloseTo(9.83, 1);
    expect(body.feet.y).toBeCloseTo(0);
    world.dispose();
  });

  it('rejects an export with a missing anchor', async () => {
    const root = await parseModel('gallery');
    root.getObjectByName('Exhibit_05')?.removeFromParent();
    expect(() => createGallery(root, new Group())).toThrow(
      'anchor count differs',
    );
  });
});

describe('display frames and gallery lights', () => {
  it('models the frame in front of its origin with an upright, unmirrored canvas', async () => {
    const frame = await parseModel('frame');
    const bounds = new Box3().setFromObject(frame);
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(1.3);
    expect(size.y).toBeCloseTo(1.0);
    expect(bounds.min.z).toBeCloseTo(0);
    expect(bounds.max.z).toBeCloseTo(0.05);
    // A visitor faces the frame looking down -Z, so their top-left is -X, +Y.
    // glTF UVs put (0, 0) at the image's top-left and (1, 1) at bottom-right.
    const canvas = frame.getObjectByName('Frame_Canvas');
    if (!(canvas instanceof Mesh)) throw new Error('Missing Frame_Canvas.');
    const { position, uv } = canvas.geometry.attributes;
    const corners = Array.from({ length: position.count }, (_, index) => ({
      x: position.getX(index),
      y: position.getY(index),
      u: uv.getX(index),
      v: uv.getY(index),
    }));
    const topLeft = corners.reduce((best, c) =>
      c.y - c.x > best.y - best.x ? c : best,
    );
    const bottomRight = corners.reduce((best, c) =>
      c.x - c.y > best.x - best.y ? c : best,
    );
    expect([topLeft.u, topLeft.v]).toEqual([0, 0]);
    expect([bottomRight.u, bottomRight.v]).toEqual([1, 1]);
  });

  it('hangs one frame on each anchor', async () => {
    const world = await loadWorld();
    for (const anchor of world.anchors) {
      const canvases: string[] = [];
      anchor.traverse((node) => {
        if (node.name === 'Frame_Canvas') canvases.push(node.name);
      });
      expect(canvases, anchor.name).toHaveLength(1);
    }
    world.dispose();
  });

  it('aims one spot light at each display from above the walkway', async () => {
    const world = await loadWorld();
    const spots: SpotLight[] = [];
    world.scene.traverse((node) => {
      if (node instanceof SpotLight) spots.push(node);
    });
    expect(spots).toHaveLength(15);

    for (const anchor of world.anchors) {
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
          origin.y > 3
        );
      });
      expect(aimed, anchor.name).toHaveLength(1);
    }
    world.dispose();
  });
});

describe('gallery export budget', () => {
  it('keeps both models within the gallery transfer budget', async () => {
    const sizes = await Promise.all(
      ['gallery', 'frame'].map(
        async (name) => (await stat(`public/models/${name}.glb`)).size,
      ),
    );
    // Budget: 5 MB of the 10–20 MB initial target, leaving room for artwork.
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThan(5e6);
  });

  it('keeps draw calls low and textures within 2048 px', async () => {
    const world = await loadWorld();
    let drawCalls = 0;
    world.scene.traverseVisible((node) => {
      if (!(node instanceof Mesh)) return;
      drawCalls++;
      for (const value of Object.values(node.material)) {
        if (!(value instanceof Texture)) continue;
        const { width = 0, height = 0 } = value.image ?? {};
        expect(Math.max(width, height)).toBeLessThanOrEqual(2048);
      }
    });
    expect(drawCalls).toBeLessThanOrEqual(52);
    world.dispose();
  });

  it('exports axis-aligned COL_ proxies so their bounds stay tight', async () => {
    const root = await parseModel('gallery');
    root.updateMatrixWorld(true);
    const proxies: Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof Mesh && node.name.startsWith('COL_'))
        proxies.push(node);
    });
    expect(proxies.length).toBeGreaterThan(0);
    for (const proxy of proxies) {
      const rotation = proxy.getWorldQuaternion(new Quaternion());
      expect(rotation.angleTo(new Quaternion()), proxy.name).toBeLessThan(1e-6);
    }
  });
});

describe('basement entrance', () => {
  it('hangs the door on its hinge with a separate collider over the opening', async () => {
    const root = await parseModel('gallery');
    root.updateMatrixWorld(true);
    const hinge = root.getObjectByName('Door_Basement_Hinge');
    const door = hinge?.getObjectByName('Door_Basement');
    expect(door?.parent).toBe(hinge);
    const collider = root.getObjectByName('COL_Door_Basement');
    if (!collider) throw new Error('Missing COL_Door_Basement.');
    const bounds = new Box3().setFromObject(collider);
    expect(bounds.min.z).toBeCloseTo(-0.8);
    expect(bounds.max.z).toBeCloseTo(0.8);
    expect(bounds.max.y).toBeCloseTo(2.4);
    // The hinge sits on the opening's north jamb (Three.js -Z).
    expect(hinge?.getWorldPosition(new Vector3()).z).toBeCloseTo(-0.8);
  });

  it('labels the sign BASEMENT OF DOOM facing the gallery', async () => {
    const root = await parseModel('gallery');
    root.updateMatrixWorld(true);
    const sign = root.getObjectByName('Sign_Basement');
    if (!sign) throw new Error('Missing Sign_Basement.');
    expect(sign.userData.text).toBe('BASEMENT OF DOOM');
    const bounds = new Box3().setFromObject(sign);
    expect(bounds.max.x).toBeLessThanOrEqual(10);
    expect(bounds.min.y).toBeGreaterThan(2.4);
    expect(bounds.getCenter(new Vector3()).z).toBeCloseTo(0, 1);
  });

  it('keeps the statue beside the doorway, clear of the door and its approach', async () => {
    const world = await loadWorld();
    const statue = world.scene.getObjectByName('COL_Statue');
    if (!statue) throw new Error('Missing COL_Statue.');
    const bounds = new Box3().setFromObject(statue);
    // South of the door frame (z 0.95) and against the end wall.
    expect(bounds.min.z).toBeGreaterThan(0.95);
    expect(bounds.max.z).toBeLessThan(2);
    // The scythe stays in front of the end wall and the sign board.
    const render = new Box3();
    for (const name of ['Statue_Cloak', 'Statue_Blade', 'Statue_Staff']) {
      const part = world.scene.getObjectByName(name);
      if (!part) throw new Error(`Missing ${name}.`);
      render.union(new Box3().setFromObject(part));
    }
    expect(render.max.x).toBeLessThan(9.94);
    const body = {
      feet: new Vector3(8.4, 0, 2.5),
      grounded: true,
      fallSpeed: 0,
    };
    for (let count = 0; count < 100; count++)
      stepBody(body, 0, -0.025, 1 / 120, world.solids);
    expect(body.feet.z).toBeCloseTo(0, 1);
    world.dispose();
  });
});
