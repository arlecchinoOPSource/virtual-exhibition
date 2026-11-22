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
import { paintExhibit } from '../exhibition/placeholder';
import type { Exhibit } from '../types/exhibit';

const anchorNames = Array.from(
  { length: 12 },
  (_, index) => `Exhibit_${String(index + 1).padStart(2, '0')}`,
);

// Builds the walkable world from the exported gallery and display frame.
export function createGallery(root: Object3D, frame: Object3D) {
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
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (node.name.startsWith('COL_')) {
      node.visible = false;
      solids.push(new Box3().setFromObject(node));
    } else {
      surfaces.push(node);
    }
  });

  if (solids.length === 0)
    throw new Error('The gallery has no COL_ collision proxies.');

  const keyLight = new DirectionalLight(0xf6f3ee, 2.1);
  keyLight.position.set(-4, 8, 3);
  scene.add(keyLight, new HemisphereLight(0xe7edf6, 0x43464d, 1.4));

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
    dispose() {
      const resources = new Set<BufferGeometry | Material>();
      root.traverse((node) => {
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
  const world = createGallery(gallery.scene, frame.scene);
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
