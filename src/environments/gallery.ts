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
import { createDoor } from './door';
import { paintExhibit } from '../exhibition/placeholder';
import type { Exhibit } from '../types/exhibit';

const anchorNames = Array.from(
  { length: 12 },
  (_, index) => `Exhibit_${String(index + 1).padStart(2, '0')}`,
);

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

// Builds the walkable world from the exported gallery and display frame. The
// basement loads through loadBasement the first time the door opens.
export function createGallery(
  root: Object3D,
  frame: Object3D,
  loadBasement: () => Promise<Object3D> = () =>
    Promise.reject(new Error('No basement loader was provided.')),
) {
  const scene = new Scene();
  scene.background = new Color(0x252930);
  scene.add(root);

  const spawnNode = root.getObjectByName('Spawn_Gallery');
  if (!spawnNode) throw new Error('The gallery has no Spawn_Gallery marker.');
  const anchors = anchorNames.map((name) => {
    const matches: Object3D[] = [];
    root.traverse((node) => {
      if (node.name === name) matches.push(node);
    });
    const [match] = matches;
    if (!match || matches.length !== 1)
      throw new Error(`The gallery must contain exactly one ${name}.`);
    return match;
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
  const door = createDoor(hinge, doorCollider, solids, async () => {
    const basement = await loadBasement();
    scene.add(basement);
    basement.updateMatrixWorld(true);
    collect(basement, solids, surfaces, colliders);
  });

  const keyLight = new DirectionalLight(0xf6f3ee, 2.1);
  keyLight.position.set(-4, 8, 3);
  const skyLight = new HemisphereLight(0xe7edf6, 0x43464d, 1.4);
  scene.add(keyLight, skyLight);
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
    actionAt(object: Object3D | undefined, feet: Vector3) {
      for (let node = object; node; node = node.parent ?? undefined)
        if (node === doorMesh)
          return { label: door.label(feet), run: () => void door.toggle(feet) };
      return undefined;
    },
    update(seconds: number, feet?: Vector3) {
      door.update(seconds);
      if (!feet) return;
      const depth = Math.min(1, Math.max(0, (-feet.y - 0.3) / 2.1));
      const target = 1 - 0.9 * depth * depth * (3 - 2 * depth);
      daylight += (target - daylight) * Math.min(1, seconds * 2);
      keyLight.intensity = 2.1 * daylight;
      skyLight.intensity = 1.4 * daylight;
      const cellar = Math.min(1, (1 - daylight) / 0.9);
      skyLight.color.lerpColors(daySky, cellarSky, cellar);
      skyLight.groundColor.lerpColors(dayGround, cellarGround, cellar);
    },
    dispose() {
      const resources = new Set<BufferGeometry | Material>();
      scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        resources.add(node.geometry);
        for (const material of [node.material].flat()) resources.add(material);
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
  const world = createGallery(gallery.scene, frame.scene, async () => {
    const basement = await loader.loadAsync(`${models}/basement.glb`);
    return basement.scene;
  });
  const displays = hangExhibits(world.anchors, exhibits, paintExhibit);
  return {
    ...world,
    exhibitAt: displays.exhibitAt,
    dispose() {
      displays.dispose();
      world.dispose();
    },
  };
}
