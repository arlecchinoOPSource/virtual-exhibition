import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import {
  Box3,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
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
  basement_door: { hinge: [number, number]; opening: number[] };
  furniture: { id: string; rect: number[] }[];
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
  it('spawns inside the arrival elevator facing its doors and the basement door', async () => {
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
    const pages = world.scene.getObjectByName('Catalogue_Pages');
    if (!pages) throw new Error('Missing catalogue pages.');
    const pageBounds = new Box3().setFromObject(pages);
    expect(pageBounds.min.y - woodBounds.max.y).toBeLessThan(0.025);
    expect(woodBounds.max.y).toBeGreaterThan(1.15);
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

    // The back wall of the elevator car.
    walk(-0.025, 0);
    expect(body.feet.x).toBeCloseTo(-15.96, 1);
    // The gallery's west wall, beside the elevator doorway.
    body.feet.set(-13, 0, -1.5);
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
    // The band runs clear to the solid east wall.
    body.feet.set(-12.5, 0, 0);
    walk(0.025, 0);
    expect(body.feet.x).toBeCloseTo(9.76, 1);
    // The closed basement door stops a visitor walking south into the
    // cut-away corner's doorway.
    body.feet.set(7, 0, 0.5);
    walk(0, 0.025);
    expect(body.feet.z).toBeCloseTo(1.83, 1);
    expect(body.feet.y).toBeCloseTo(0);
    world.dispose();
  });

  it('lays parquet over every upstairs section with no holes', async () => {
    const world = await loadWorld();
    // The gallery floor, and the elevator car's own floor.
    const floors = ['Floor', 'Elevator_Car'].map((name) => {
      const found = world.scene.getObjectByName(name);
      if (!found) throw new Error(`Missing ${name}.`);
      return found;
    });
    const ray = new Raycaster();
    const down = new Vector3(0, -1, 0);
    for (const section of plan.sections) {
      if (section.level !== 'upstairs') continue;
      const [x0, x1, y0, y1] = section.rect as [number, number, number, number];
      for (let x = x0 + 0.25; x < x1; x += 0.5)
        for (let y = y0 + 0.25; y < y1; y += 0.5) {
          ray.set(new Vector3(x, 1, -y), down);
          const hit = ray.intersectObjects(floors, true)[0];
          expect(hit?.point.y, `${section.id} at ${x}, ${y}`).toBeCloseTo(0, 3);
        }
    }
    // None of it reaches over the cut-away corner, where the basement stairs
    // start just south of the doorway (Blender y below -2.2).
    for (let x = 6.25; x < 8; x += 0.25)
      for (const y of [-2.25, -2.6, -3.5]) {
        ray.set(new Vector3(x, 1, -y), down);
        expect(ray.intersectObjects(floors, true), `${x}, ${y}`).toHaveLength(
          0,
        );
      }
    world.dispose();
  });

  it('holds the visitor in the elevator until its doors slide open', async () => {
    const world = await loadWorld();
    const body = {
      feet: world.spawn.feet.clone(),
      grounded: true,
      fallSpeed: 0,
    };
    const walkEast = (frames: number) => {
      for (let count = 0; count < frames; count++)
        stepBody(body, 0.025, 0, 1 / 120, world.solids);
    };
    const leaves = ['Elevator_Door_South', 'Elevator_Door_North'].map((name) =>
      world.scene.getObjectByName(name)!,
    );
    const closed = leaves.map((leaf) => leaf.position.z);
    expect(world.elevator.state).toBe('closed');
    // Closed doors stop the visitor in the car, short of the doorway.
    walkEast(200);
    expect(body.feet.x).toBeCloseTo(-14.44, 1);

    world.elevator.open();
    world.update(0.5);
    expect(world.elevator.state).toBe('opening');
    expect(leaves.map((leaf) => leaf.position.z)).toEqual(closed);
    walkEast(50);
    expect(body.feet.x).toBeCloseTo(-14.44, 1);
    // Opening again mid-slide is ignored.
    world.elevator.open();
    for (let t = 0; t < 2; t += 1 / 60) world.update(1 / 60);
    expect(world.elevator.state).toBe('open');
    // Each leaf slid its own width away from the middle, into the wall.
    expect(leaves[0]!.position.z - closed[0]!).toBeCloseTo(0.9);
    expect(leaves[1]!.position.z - closed[1]!).toBeCloseTo(-0.9);
    walkEast(200);
    expect(body.feet.x).toBeGreaterThan(-12);
    world.dispose();
  });

  it('opens the elevator at once for reduced motion', async () => {
    const world = await loadWorld();
    const leaf = world.scene.getObjectByName('Elevator_Door_South')!;
    const closed = leaf.position.z;
    world.elevator.open(true);
    expect(world.elevator.state).toBe('open');
    // The south leaf slid its full width south (Three.js +Z) at once.
    expect(leaf.position.z - closed).toBeCloseTo(0.9, 3);
    world.dispose();
  });

  it('rejects an export with a missing anchor', async () => {
    const root = await parseModel('gallery');
    root.getObjectByName('Exhibit_05')?.removeFromParent();
    expect(() => createGallery(root, new Group())).toThrow(
      'The gallery is missing Exhibit_05.',
    );
  });

  it('rejects a basement slot exported in the gallery', async () => {
    const root = await parseModel('gallery');
    const stray = new Group();
    stray.name = 'Exhibit_16';
    root.add(stray);
    expect(() => createGallery(root, new Group())).toThrow(
      'Exhibit_16 does not belong in the gallery.',
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
    for (const spot of spots) {
      expect(spot.intensity).toBeCloseTo(20);
      expect(spot.angle).toBeCloseTo((27 * Math.PI) / 180);
    }

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

describe('third-party props', () => {
  it('furnishes the studio in one vertex-coloured draw inside the planned envelopes', async () => {
    const world = await loadWorld();
    const props = world.scene.getObjectByName('Studio_Props');
    if (!(props instanceof Mesh)) throw new Error('Missing Studio_Props.');
    expect(Array.isArray(props.material)).toBe(false);
    expect((props.material as MeshStandardMaterial).vertexColors).toBe(true);
    expect(props.geometry.getAttribute('color')).toBeDefined();
    expect(props.geometry.getAttribute('uv')).toBeUndefined();
    const envelope = (id: string) =>
      plan.furniture.find((item) => item.id === id)!.rect as [
        number,
        number,
        number,
        number,
      ];
    // Each prop's collision box sits inside its plan envelope, on the floor.
    for (const id of [
      'Studio_Easel',
      'Studio_Worktable',
      'Studio_Statue',
      'Studio_Supplies',
    ]) {
      const proxy = world.scene.getObjectByName(`COL_${id}`);
      if (!proxy) throw new Error(`Missing COL_${id}.`);
      const bounds = new Box3().setFromObject(proxy);
      const [x0, x1, y0, y1] = envelope(id);
      expect(bounds.min.x, id).toBeGreaterThanOrEqual(x0 - 1e-3);
      expect(bounds.max.x, id).toBeLessThanOrEqual(x1 + 1e-3);
      expect(bounds.min.z, id).toBeGreaterThanOrEqual(-y1 - 1e-3);
      expect(bounds.max.z, id).toBeLessThanOrEqual(-y0 + 1e-3);
      expect(bounds.min.y, id).toBeCloseTo(0, 3);
    }
    // Walking north into the easel stops in front of it.
    const body = {
      feet: new Vector3(-10.5, 0, -6.6),
      grounded: true,
      fallSpeed: 0,
    };
    for (let i = 0; i < 200; i++)
      stepBody(body, 0, -0.025, 1 / 120, world.solids);
    expect(body.feet.z).toBeGreaterThan(-6.82 + 0.2);
    // No prop or panel stands between a studio frame and its viewing zone.
    for (const slot of ['Exhibit_01', 'Exhibit_02', 'Exhibit_03']) {
      const frame = plan.frames.find((f) => f.slot === slot)!;
      const [gx, gz] = gazes[frame.gaze]!;
      const target = new Vector3(frame.at[0], 1.5, -frame.at[1]);
      const camera = new PerspectiveCamera();
      camera.position.copy(target).add(new Vector3(-gx * 1.5, 0.1, -gz * 1.5));
      camera.lookAt(target);
      const pick = createSurfacePicker(camera, world.surfaces, 3);
      expect(pick()?.name, slot).toBe('Frame_Canvas');
    }
    world.dispose();
  });

  it('furnishes the reading area with one shared shelf mesh, one prop draw and clear frames', async () => {
    const world = await loadWorld();
    const props = world.scene.getObjectByName('Reading_Props');
    if (!(props instanceof Mesh)) throw new Error('Missing Reading_Props.');
    expect((props.material as MeshStandardMaterial).vertexColors).toBe(true);
    expect(props.geometry.getAttribute('uv')).toBeUndefined();
    // Both shelves draw the same stored bookcase.
    const west = world.scene.getObjectByName('Reading_Shelf_West');
    const east = world.scene.getObjectByName('Reading_Shelf_East');
    if (!(west instanceof Mesh) || !(east instanceof Mesh))
      throw new Error('Missing a reading shelf.');
    expect(east.geometry).toBe(west.geometry);
    const envelope = (id: string) =>
      plan.furniture.find((item) => item.id === id)!.rect as [
        number,
        number,
        number,
        number,
      ];
    for (const id of [
      'Reading_Shelf_West',
      'Reading_Shelf_East',
      'Reading_Desk',
    ]) {
      const proxy = world.scene.getObjectByName(`COL_${id}`);
      if (!proxy) throw new Error(`Missing COL_${id}.`);
      const bounds = new Box3().setFromObject(proxy);
      const [x0, x1, y0, y1] = envelope(id);
      expect(bounds.min.x, id).toBeGreaterThanOrEqual(x0 - 1e-3);
      expect(bounds.max.x, id).toBeLessThanOrEqual(x1 + 1e-3);
      expect(bounds.min.z, id).toBeGreaterThanOrEqual(-y1 - 1e-3);
      expect(bounds.max.z, id).toBeLessThanOrEqual(-y0 + 1e-3);
    }
    // The scrolls are decoration: no collider.
    expect(world.scene.getObjectByName('COL_Reading_Scrolls')).toBeUndefined();
    // Walking south into the desk stops in front of it, clear of the axis.
    const body = {
      feet: new Vector3(-6.2, 0, 0.2),
      grounded: true,
      fallSpeed: 0,
    };
    for (let i = 0; i < 200; i++)
      stepBody(body, 0, 0.025, 1 / 120, world.solids);
    expect(body.feet.z).toBeLessThan(1.25 - 0.2);
    expect(body.feet.z).toBeGreaterThan(0.6);
    for (const slot of ['Exhibit_07', 'Exhibit_08', 'Exhibit_09']) {
      const frame = plan.frames.find((f) => f.slot === slot)!;
      const [gx, gz] = gazes[frame.gaze]!;
      const target = new Vector3(frame.at[0], 1.5, -frame.at[1]);
      const camera = new PerspectiveCamera();
      camera.position.copy(target).add(new Vector3(-gx * 1.5, 0.1, -gz * 1.5));
      camera.lookAt(target);
      const pick = createSurfacePicker(camera, world.surfaces, 3);
      expect(pick()?.name, slot).toBe('Frame_Canvas');
    }
    world.dispose();
  });
});

describe('living room', () => {
  it('furnishes the living room in one prop draw, one glass draw and clear frames', async () => {
    const world = await loadWorld();
    const props = world.scene.getObjectByName('Living_Props');
    if (!(props instanceof Mesh)) throw new Error('Missing Living_Props.');
    expect((props.material as MeshStandardMaterial).vertexColors).toBe(true);
    expect(props.geometry.getAttribute('uv')).toBeUndefined();
    // The display case's and the TV's glass stay see-through.
    const glass = world.scene.getObjectByName('Prop_Glass');
    if (!(glass instanceof Mesh)) throw new Error('Missing Prop_Glass.');
    const glassMaterial = glass.material as MeshStandardMaterial;
    expect(glassMaterial.transparent).toBe(true);
    expect(glassMaterial.opacity).toBeLessThan(0.5);
    for (const id of [
      'Living_TV',
      'Living_Small_Table',
      'Living_Couch',
      'Living_Display_Case',
      'Living_Dining_Set',
      'Living_Vase',
    ]) {
      const proxy = world.scene.getObjectByName(`COL_${id}`);
      if (!proxy) throw new Error(`Missing COL_${id}.`);
      const bounds = new Box3().setFromObject(proxy);
      const [x0, x1, y0, y1] = plan.furniture.find((item) => item.id === id)!
        .rect as [number, number, number, number];
      expect(bounds.min.x, id).toBeGreaterThanOrEqual(x0 - 1e-3);
      expect(bounds.max.x, id).toBeLessThanOrEqual(x1 + 1e-3);
      expect(bounds.min.z, id).toBeGreaterThanOrEqual(-y1 - 1e-3);
      expect(bounds.max.z, id).toBeLessThanOrEqual(-y0 + 1e-3);
    }
    for (const slot of ['Exhibit_10', 'Exhibit_11', 'Exhibit_12']) {
      const frame = plan.frames.find((f) => f.slot === slot)!;
      const [gx, gz] = gazes[frame.gaze]!;
      const target = new Vector3(frame.at[0], 1.5, -frame.at[1]);
      const camera = new PerspectiveCamera();
      camera.position.copy(target).add(new Vector3(-gx * 1.5, 0.1, -gz * 1.5));
      camera.lookAt(target);
      const pick = createSurfacePicker(camera, world.surfaces, 3);
      expect(pick()?.name, slot).toBe('Frame_Canvas');
    }
    world.dispose();
  });
});

describe('theater', () => {
  it('furnishes the theater in one prop draw below the ceiling with clear frames', async () => {
    const world = await loadWorld();
    const props = world.scene.getObjectByName('Theater_Props');
    if (!(props instanceof Mesh)) throw new Error('Missing Theater_Props.');
    expect((props.material as MeshStandardMaterial).vertexColors).toBe(true);
    expect(props.geometry.getAttribute('uv')).toBeUndefined();
    // Scenery stays below the 3.6 m ceiling.
    expect(new Box3().setFromObject(props).max.y).toBeLessThan(3.6);
    for (const id of [
      'Theater_Bench_West',
      'Theater_Bench_East',
      'Theater_Castle_West',
      'Theater_Castle_East',
      'Theater_Banner_West',
      'Theater_Banner_East',
      'Theater_Window',
      'Theater_Vase',
    ]) {
      const proxy = world.scene.getObjectByName(`COL_${id}`);
      if (!proxy) throw new Error(`Missing COL_${id}.`);
      const bounds = new Box3().setFromObject(proxy);
      const [x0, x1, y0, y1] = plan.furniture.find((item) => item.id === id)!
        .rect as [number, number, number, number];
      expect(bounds.min.x, id).toBeGreaterThanOrEqual(x0 - 1e-3);
      expect(bounds.max.x, id).toBeLessThanOrEqual(x1 + 1e-3);
      expect(bounds.min.z, id).toBeGreaterThanOrEqual(-y1 - 1e-3);
      expect(bounds.max.z, id).toBeLessThanOrEqual(-y0 + 1e-3);
    }
    for (const slot of ['Exhibit_13', 'Exhibit_14', 'Exhibit_15']) {
      const frame = plan.frames.find((f) => f.slot === slot)!;
      const [gx, gz] = gazes[frame.gaze]!;
      const target = new Vector3(frame.at[0], 1.5, -frame.at[1]);
      const camera = new PerspectiveCamera();
      camera.position.copy(target).add(new Vector3(-gx * 1.5, 0.1, -gz * 1.5));
      camera.lookAt(target);
      const pick = createSurfacePicker(camera, world.surfaces, 3);
      expect(pick()?.name, slot).toBe('Frame_Canvas');
    }
    world.dispose();
  });
});

describe('street', () => {
  it('furnishes the street in one prop draw with a near-flush sidewalk and clear frames', async () => {
    const world = await loadWorld();
    const props = world.scene.getObjectByName('Street_Props');
    if (!(props instanceof Mesh)) throw new Error('Missing Street_Props.');
    expect((props.material as MeshStandardMaterial).vertexColors).toBe(true);
    expect(new Box3().setFromObject(props).max.y).toBeLessThan(3.6);
    for (const id of [
      'Street_Facade_West',
      'Street_Facade_Middle',
      'Street_Store',
      'Street_Jeepney',
      'Street_Planter_West',
      'Street_Planter_East',
    ]) {
      const proxy = world.scene.getObjectByName(`COL_${id}`);
      if (!proxy) throw new Error(`Missing COL_${id}.`);
      const bounds = new Box3().setFromObject(proxy);
      const [x0, x1, y0, y1] = plan.furniture.find((item) => item.id === id)!
        .rect as [number, number, number, number];
      expect(bounds.min.x, id).toBeGreaterThanOrEqual(x0 - 1e-3);
      expect(bounds.max.x, id).toBeLessThanOrEqual(x1 + 1e-3);
      expect(bounds.min.z, id).toBeGreaterThanOrEqual(-y1 - 1e-3);
      expect(bounds.max.z, id).toBeLessThanOrEqual(-y0 + 1e-3);
    }
    // The sidewalk has no collider: a visitor walks onto it and stays on the floor.
    const body = {
      feet: new Vector3(-3.5, 0, -5.6),
      grounded: true,
      fallSpeed: 0,
    };
    for (let i = 0; i < 120; i++)
      stepBody(body, 0, -0.01, 1 / 120, world.solids);
    expect(body.feet.z).toBeLessThan(-6.5);
    expect(body.feet.y).toBeCloseTo(0, 2);
    for (const slot of ['Exhibit_04', 'Exhibit_05', 'Exhibit_06']) {
      const frame = plan.frames.find((f) => f.slot === slot)!;
      const [gx, gz] = gazes[frame.gaze]!;
      const target = new Vector3(frame.at[0], 1.5, -frame.at[1]);
      const camera = new PerspectiveCamera();
      camera.position.copy(target).add(new Vector3(-gx * 1.5, 0.1, -gz * 1.5));
      camera.lookAt(target);
      const pick = createSurfacePicker(camera, world.surfaces, 3);
      expect(pick()?.name, slot).toBe('Frame_Canvas');
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
    // Budget: 6 MB of the 10–20 MB initial target, leaving room for artwork.
    // Raised from 5 MB in #94: with four rooms furnished, the shared shell
    // (parquet, fixtures, signage) is most of it, and room props are simplified.
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThan(6e6);
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
    // 52 for the shell, lectern, statue and fifteen frames, three for the
    // arrival elevator (its sliding leaves stay separate), and two for the
    // studio (#91): its joined props and its bamboo panelling; four for the
    // reading area (#92): its joined props, the shelf drawn twice and its
    // terracotta finish; three for the living room (#93): its joined props,
    // the shared glass of the display case and TV, and its teal paint; two
    // for the theater (#94): its joined props and its burgundy paint. The
    // street (#95) fits within the same cap: its props join into one draw and
    // the truck's glass shares Prop_Glass.
    // The five room casings share one additional draw.
    expect(drawCalls).toBeLessThanOrEqual(68);
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
    // Across the opening in the cut-away corner's north wall (#87 revision).
    const [x0, x1, y0, y1] = plan.basement_door.opening as [
      number,
      number,
      number,
      number,
    ];
    expect(bounds.min.x).toBeCloseTo(x0);
    expect(bounds.max.x).toBeCloseTo(x1);
    expect(bounds.min.z).toBeGreaterThan(-y1);
    expect(bounds.max.z).toBeLessThan(-y0);
    expect(bounds.max.y).toBeCloseTo(2.4);
    // The hinge sits on the opening's east jamb, where the plan puts it.
    const at = hinge!.getWorldPosition(new Vector3());
    expect(at.x).toBeCloseTo(plan.basement_door.hinge[0]);
    expect(at.z).toBeCloseTo(-plan.basement_door.hinge[1]);
    // Its own rotation stays zero, so the door module's swing starts closed.
    expect(hinge!.rotation.y).toBeCloseTo(0);
  });

  it('labels the sign BASEMENT OF DOOM facing the gallery', async () => {
    const root = await parseModel('gallery');
    root.updateMatrixWorld(true);
    const sign = root.getObjectByName('Sign_Basement');
    if (!sign) throw new Error('Missing Sign_Basement.');
    expect(sign.userData.text).toBe('BASEMENT OF DOOM');
    const bounds = new Box3().setFromObject(sign);
    // On the gallery side of the cut-away corner's wall, over the doorway.
    expect(bounds.max.z).toBeLessThanOrEqual(2.0);
    expect(bounds.min.y).toBeGreaterThan(2.4);
    expect(bounds.getCenter(new Vector3()).x).toBeCloseTo(7, 1);
  });

  it('keeps the statue beside the doorway, clear of the door and its approach', async () => {
    const world = await loadWorld();
    const statue = world.scene.getObjectByName('COL_Statue');
    if (!statue) throw new Error('Missing COL_Statue.');
    const bounds = new Box3().setFromObject(statue);
    // West of the door frame (x 6.05) and against the corner's wall.
    expect(bounds.max.x).toBeLessThan(6.05);
    expect(bounds.min.x).toBeGreaterThan(5);
    // The scythe stays in front of the end wall and the sign board.
    const render = new Box3();
    for (const name of ['Statue_Cloak', 'Statue_Blade', 'Statue_Staff']) {
      const part = world.scene.getObjectByName(name);
      if (!part) throw new Error(`Missing ${name}.`);
      render.union(new Box3().setFromObject(part));
    }
    expect(render.max.z).toBeLessThan(1.94);
    const body = {
      feet: new Vector3(5.25, 0, 0.4),
      grounded: true,
      fallSpeed: 0,
    };
    // 1.75 m east past the statue onto the door's axis.
    for (let count = 0; count < 70; count++)
      stepBody(body, 0.025, 0, 1 / 120, world.solids);
    expect(body.feet.x).toBeCloseTo(7, 1);
    world.dispose();
  });
});
