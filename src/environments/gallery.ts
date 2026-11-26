import {
  Box3,
  Color,
  DirectionalLight,
  Euler,
  HemisphereLight,
  Mesh,
  Quaternion,
  Scene,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { hangExhibits } from '../exhibition/displays';
import { shadeEntrance } from './entrance-shadow';
import { createDoor, createRoomDoor } from './door';
import { createElevator } from './elevator';
import { paintExhibit } from '../exhibition/placeholder';
import type { Exhibit, ExhibitAnchor } from '../types/exhibit';

import {
  basementAnchors,
  galleryAnchors,
  sectionOf,
} from '../exhibition/manifest';

// Hides COL_ proxies as solids and collects visible meshes as ray surfaces.
function collect(
  root: Object3D,
  solids: Box3[],
  surfaces: Mesh[],
  colliders: Map<string, Box3>,
) {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (node.name.startsWith('COL_')) {
      node.visible = false;
      const box = new Box3().setFromObject(node);
      solids.push(box);
      colliders.set(node.name, box);
    } else {
      surfaces.push(node);
    }
  });
}

// Returns a root's exhibit anchors in manifest order, refusing duplicates,
// missing slots and slots that belong to the other environment.
function resolveAnchors(
  root: Object3D,
  expected: readonly ExhibitAnchor[],
  where: string,
) {
  const found = new Map<string, Object3D>();
  root.traverse((node) => {
    if (!node.name.startsWith('Exhibit_')) return;
    if (found.has(node.name))
      throw new Error(`Duplicate ${where} anchor: ${node.name}.`);
    if (!expected.includes(node.name as ExhibitAnchor))
      throw new Error(`${node.name} does not belong in the ${where}.`);
    found.set(node.name, node);
  });
  return expected.map((name) => {
    const match = found.get(name);
    if (!match) throw new Error(`The ${where} is missing ${name}.`);
    return match;
  });
}

// Frees a model's own geometry and materials, leaving the shared frame's.
function release(root: Object3D, keep: ReadonlySet<unknown>) {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    for (const resource of [node.geometry, node.material].flat())
      if (!keep.has(resource)) resource.dispose();
  });
}

// Builds the walkable world from the exported gallery and display frame. The
// basement loads through loadBasement the first time the door opens; its
// three frames are attached then and handed to hangBasement, before the
// basement joins the scene. A failed load leaves nothing behind and can be
// retried; a successful one is never repeated.
export function createGallery(
  root: Object3D,
  frame: Object3D,
  loadBasement: () => Promise<Object3D> = () =>
    Promise.reject(new Error('No basement loader was provided.')),
  hangBasement: (anchors: Object3D[]) => void = () => {},
) {
  const scene = new Scene();
  scene.background = new Color(0x252930);
  scene.add(root);

  const spawnNode = root.getObjectByName('Spawn_Gallery');
  if (!spawnNode) throw new Error('The gallery has no Spawn_Gallery marker.');
  const anchors = resolveAnchors(root, galleryAnchors, 'gallery');
  const shared = new Set<unknown>();
  frame.traverse((node) => {
    if (node instanceof Mesh)
      [node.geometry, node.material].flat().forEach((r) => shared.add(r));
  });
  // Clones share the frame's geometry and materials.
  for (const anchor of anchors) anchor.add(frame.clone());
  root.updateMatrixWorld(true);

  const solids: Box3[] = [];
  const surfaces: Mesh[] = [];
  const colliders = new Map<string, Box3>();
  collect(root, solids, surfaces, colliders);

  if (solids.length === 0)
    throw new Error('The gallery has no COL_ collision proxies.');

  const hinge = root.getObjectByName('Door_Basement_Hinge');
  const doorMesh = hinge?.getObjectByName('Door_Basement');
  const doorCollider = colliders.get('COL_Door_Basement');
  if (!hinge || !doorMesh || !doorCollider)
    throw new Error('The gallery is missing the basement door.');
  const roomHinges = new Map<string, Object3D[]>();
  root.traverse((node) => {
    const name: unknown = node.userData.roomDoor;
    if (typeof name !== 'string') return;
    const pair = roomHinges.get(name) ?? [];
    pair.push(node);
    roomHinges.set(name, pair);
  });
  const roomDoors = new Map<Object3D, ReturnType<typeof createRoomDoor>>();
  const doorPairs = [...roomHinges.values()].map((pair) => {
    const roomDoor = createRoomDoor(pair, colliders, solids);
    for (const pivot of pair) roomDoors.set(pivot, roomDoor);
    return roomDoor;
  });
  const leaves = ['Elevator_Door_South', 'Elevator_Door_North'].map((name) =>
    root.getObjectByName(name),
  );
  const elevatorCollider = colliders.get('COL_Elevator_Doors');
  if (!leaves[0] || !leaves[1] || !elevatorCollider)
    throw new Error('The gallery is missing the arrival elevator doors.');
  // The visitor arrives in the elevator car; its doors open as the walk starts.
  const elevator = createElevator(
    leaves as Object3D[],
    elevatorCollider,
    solids,
  );
  const catalogue = root.getObjectByName('Catalogue_Pages');
  const cataloguePrint = root.getObjectByName('Catalogue_Print');
  if (!catalogue) throw new Error('The gallery is missing its catalogue.');

  const galleryKeyIntensity = 0.22;
  const galleryFillIntensity = 0.42;
  const keyLight = new DirectionalLight(0xf6f3ee, galleryKeyIntensity);
  keyLight.position.set(-4, 8, 3);
  const skyLight = new HemisphereLight(
    0xe7edf6,
    0x43464d,
    galleryFillIntensity,
  );
  scene.add(keyLight, skyLight);

  // The basement is drawn in a second pass, lit only by its own lamps and the
  // fading daylight. Sharing the gallery's spotlights made each of its
  // shaders unroll lights it never sees, and the bulbs' arrival rebuilt every
  // gallery shader: opening the door froze the view for seconds.
  const downstairs = new Scene();
  const downstairsKey = keyLight.clone();
  const downstairsSky = skyLight.clone();
  // Leave only a trace of gallery spill before the bulbs and picture lights.
  const basementKeyIntensity = 0.16;
  const basementFillIntensity = 0.2;
  downstairsKey.intensity = basementKeyIntensity;
  downstairsSky.intensity = basementFillIntensity;
  downstairs.add(downstairsKey, downstairsSky);
  let basementReady = false;
  let disposed = false;
  const door = createDoor(hinge, doorCollider, solids, async () => {
    if (basementReady) return;
    const basement = await loadBasement();
    // The world went away while the basement was on its way.
    if (disposed) return release(basement, shared);
    try {
      const downstairsAnchors = resolveAnchors(
        basement,
        basementAnchors,
        'basement',
      );
      for (const anchor of downstairsAnchors) anchor.add(frame.clone());
      hangBasement(downstairsAnchors);
    } catch (error) {
      release(basement, shared);
      throw error;
    }
    downstairs.add(basement);
    basement.updateMatrixWorld(true);
    collect(basement, solids, surfaces, colliders);
    basementReady = true;
  });
  // Daylight fades with depth down the stairs, so the basement's bulbs and
  // candles take over without a switch. What fill remains below ground takes
  // the warm cast of the bulbs, as light bounced off old plaster would.
  const daySky = skyLight.color.clone();
  const dayGround = skyLight.groundColor.clone();
  const cellarSky = new Color(0x8a6a4c);
  const cellarGround = new Color(0x2a1e16);
  let daylight = 1;

  return {
    scene,
    passes: [downstairs],
    solids,
    surfaces,
    anchors,
    spawn: {
      feet: spawnNode.getWorldPosition(new Vector3()),
      // Markers look along local -Z after export, like a Three.js camera.
      yaw: new Euler().setFromQuaternion(
        spawnNode.getWorldQuaternion(new Quaternion()),
        'YXZ',
      ).y,
    },
    door,
    elevator,
    isCatalogue(object: Object3D | undefined) {
      return (
        object === catalogue ||
        (cataloguePrint !== undefined && object === cataloguePrint)
      );
    },
    actionAt(object: Object3D | undefined, feet: Vector3) {
      for (let node = object; node; node = node.parent ?? undefined) {
        if (node === doorMesh)
          return { label: door.label(feet), run: () => void door.toggle(feet) };
        const roomDoor = roomDoors.get(node);
        if (roomDoor)
          return {
            label: roomDoor.label(feet),
            run: () => roomDoor.toggle(feet),
          };
      }
      return undefined;
    },
    update(seconds: number, feet?: Vector3) {
      door.update(seconds);
      for (const roomDoor of doorPairs) roomDoor.update(seconds);
      elevator.update(seconds);
      if (!feet) return;
      const depth = Math.min(1, Math.max(0, (-feet.y - 0.3) / 2.1));
      const target = 1 - 0.9 * depth * depth * (3 - 2 * depth);
      daylight += (target - daylight) * Math.min(1, seconds * 2);
      keyLight.intensity = galleryKeyIntensity * daylight;
      skyLight.intensity = galleryFillIntensity * daylight;
      const cellar = Math.min(1, (1 - daylight) / 0.9);
      skyLight.color.lerpColors(daySky, cellarSky, cellar);
      skyLight.groundColor.lerpColors(dayGround, cellarGround, cellar);
      downstairsKey.intensity = basementKeyIntensity * daylight;
      downstairsSky.intensity = basementFillIntensity * daylight;
      downstairsSky.color.copy(skyLight.color);
      downstairsSky.groundColor.copy(skyLight.groundColor);
    },
    dispose() {
      disposed = true;
      const resources = new Set<BufferGeometry | Material>();
      for (const root of [scene, downstairs])
        root.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          resources.add(node.geometry);
          for (const material of [node.material].flat())
            resources.add(material);
        });
      for (const resource of resources) resource.dispose();
    },
  };
}

export async function loadGallery(exhibits: readonly Exhibit[]) {
  const loader = new GLTFLoader();
  const models = `${import.meta.env.BASE_URL}models`;
  const [gallery, frame] = await Promise.all([
    loader.loadAsync(`${models}/gallery.glb`),
    loader.loadAsync(`${models}/frame.glb`),
  ]);
  const upstairs = exhibits.filter((e) => sectionOf[e.anchor] !== 'basement');
  const downstairs = exhibits.filter((e) => sectionOf[e.anchor] === 'basement');
  // Basement artwork is painted (and any image fetched) only once it loads.
  let basementDisplays: ReturnType<typeof hangExhibits> | undefined;
  const world = createGallery(
    gallery.scene,
    frame.scene,
    async () => {
      const basement = await loader.loadAsync(`${models}/basement.glb`);
      return basement.scene;
    },
    (anchors) => {
      basementDisplays = hangExhibits(anchors, downstairs, paintExhibit);
    },
  );
  const displays = hangExhibits(world.anchors, upstairs, paintExhibit);
  shadeEntrance(world.scene);
  return {
    ...world,
    exhibitAt: (object: Object3D | undefined) =>
      displays.exhibitAt(object) ?? basementDisplays?.exhibitAt(object),
    dispose() {
      displays.dispose();
      basementDisplays?.dispose();
      world.dispose();
    },
  };
}
