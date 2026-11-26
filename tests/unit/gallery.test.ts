import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import {
  Box3,
  Euler,
  Group,
  Mesh,
  Quaternion,
  PerspectiveCamera,
  Raycaster,
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

// The accepted layout (#86). Plan points are Blender (x, y); Three.js puts
// them at (x, height, -y).
const plan = JSON.parse(
  readFileSync('assets-source/layout/redesign.json', 'utf8'),
) as {
  spawn: { at: [number, number] };
  sections: { id: string; level: string; rect: number[] }[];
  lectern: { rect: [number, number, number, number] };
  frames: { slot: string; at: [number, number]; gaze: string }[];
};
const gazes: Record<string, [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
};

describe('gallery blockout', () => {
  it('spawns at the arrival end of the central band facing the basement door', async () => {
    const world = await loadWorld();
    const [x, y] = plan.spawn.at;
    expect(world.spawn.feet.x).toBeCloseTo(x);
    expect(world.spawn.feet.y).toBeCloseTo(0);
    expect(world.spawn.feet.z).toBeCloseTo(-y);
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
      // Exactly where the accepted plan put the slot, facing the same way.
      const slot = plan.frames.find((frame) => frame.slot === anchor.name)!;
      expect(position.x, anchor.name).toBeCloseTo(slot.at[0], 3);
      expect(position.z, anchor.name).toBeCloseTo(-slot.at[1], 3);
      expect(position.y, anchor.name).toBeCloseTo(1.5, 3);
      const [gx, gz] = gazes[slot.gaze]!;
      expect(-outward.x, anchor.name).toBeCloseTo(gx);
      expect(-outward.z, anchor.name).toBeCloseTo(gz);
    }
    world.dispose();
  });

  it('turns the catalogue stand to face the arrival axis behind a tight proxy', async () => {
    const world = await loadWorld();
    const [x0, x1, y0, y1] = plan.lectern.rect;
    const proxy = world.scene.getObjectByName('COL_Lectern_Clearance');
    if (!proxy) throw new Error('Missing COL_Lectern_Clearance.');
    const bounds = new Box3().setFromObject(proxy);
    expect([bounds.min.x, bounds.max.x]).toEqual([
      expect.closeTo(x0, 3),
      expect.closeTo(x1, 3),
    ]);
    expect([bounds.min.z, bounds.max.z]).toEqual([
      expect.closeTo(-y1, 3),
      expect.closeTo(-y0, 3),
    ]);
    // The woodwork stays inside its proxy after the quarter turn.
    const wood = world.scene.getObjectByName('Lectern_Woodwork');
    if (!wood) throw new Error('Missing Lectern_Woodwork.');
    const woodBounds = new Box3().setFromObject(wood);
    expect(woodBounds.min.x).toBeGreaterThan(x0 - 0.02);
    expect(woodBounds.max.x).toBeLessThan(x1 + 0.02);
    expect(woodBounds.min.z).toBeGreaterThan(-y1 - 0.02);
    expect(woodBounds.max.z).toBeLessThan(-y0 + 0.02);
    const cx = (x0 + x1) / 2;
    const cz = -(y0 + y1) / 2;
    // The reader stands on the north side (Three.js -Z), on the arrival axis.
    expect(
      world.solids.some((box) =>
        box.containsPoint(new Vector3(cx, 0.5, cz - 0.95)),
      ),
    ).toBe(false);
    expect(
      world.isCatalogue(world.scene.getObjectByName('Catalogue_Pages')),
    ).toBe(true);
    const camera = new PerspectiveCamera();
    camera.position.set(cx, 1.65, cz - 1.65);
    camera.lookAt(cx - 0.07, 1.15, cz);
    const pick = createSurfacePicker(camera, world.surfaces, 3);
    expect(world.isCatalogue(pick())).toBe(true);
    // Out of reach from 3.7 m down the band.
    camera.position.set(cx + 3.7, 1.65, cz);
    camera.lookAt(cx, 1.15, cz);
    expect(world.isCatalogue(pick())).toBe(false);
    expect(world.isCatalogue(undefined)).toBe(false);
    expect(world.anchors.every((anchor) => anchor.children.length === 1)).toBe(
      true,
    );
    world.dispose();
  });

  it('blocks the outer walls and partitions and reaches the closed door', async () => {
    const world = await loadWorld();
    const body = {
      feet: world.spawn.feet.clone(),
      grounded: true,
      fallSpeed: 0,
    };
    const walk = (dx: number, dz: number) => {
      for (let count = 0; count < 2000; count++)
        stepBody(body, dx, dz, 1 / 120, world.solids);
    };

    // The west wall behind the elevator.
    walk(-0.025, 0);
    expect(body.feet.x).toBeCloseTo(-13.76, 1);
    // The spine north of the band, between the studio and living doors.
    body.feet.set(-9, 0, 0);
    walk(0, -0.025);
    expect(body.feet.z).toBeCloseTo(-1.76, 1);
    // The south partition, the same way.
    body.feet.set(-9, 0, -0.5);
    walk(0, 0.025);
    expect(body.feet.z).toBeCloseTo(0.71, 1);
    // The band runs clear to the closed basement door.
    body.feet.set(-12.5, 0, 0);
    walk(0.025, 0);
    expect(body.feet.x).toBeCloseTo(9.83, 1);
    expect(body.feet.y).toBeCloseTo(0);
    world.dispose();
  });

  it('lays parquet over every upstairs section with no holes', async () => {
    const world = await loadWorld();
    const floor = world.scene.getObjectByName('Floor');
    if (!floor) throw new Error('Missing Floor.');
    const ray = new Raycaster();
    const down = new Vector3(0, -1, 0);
    for (const section of plan.sections) {
      if (section.level !== 'upstairs') continue;
      const [x0, x1, y0, y1] = section.rect as [number, number, number, number];
      for (let x = x0 + 0.25; x < x1; x += 0.5)
        for (let y = y0 + 0.25; y < y1; y += 0.5) {
          ray.set(new Vector3(x, 1, -y), down);
          const hit = ray.intersectObject(floor, true)[0];
          expect(hit?.point.y, `${section.id} at ${x}, ${y}`).toBeCloseTo(0, 3);
        }
    }
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
      feet: new Vector3(8.4, 0, 1.75),
      grounded: true,
      fallSpeed: 0,
    };
    // 1.75 m north past the statue, from inside the notch wall's line.
    for (let count = 0; count < 70; count++)
      stepBody(body, 0, -0.025, 1 / 120, world.solids);
    expect(body.feet.z).toBeCloseTo(0, 1);
    world.dispose();
  });
});
