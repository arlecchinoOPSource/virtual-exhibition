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
import type { Material, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const anchorNames = Array.from(
  { length: 12 },
  (_, index) => `Exhibit_${String(index + 1).padStart(2, '0')}`,
);

// Builds the walkable world from an exported gallery scene graph.
export function createGallery(root: Object3D) {
  const scene = new Scene();
  scene.background = new Color(0x252930);
  scene.add(root);
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

  const spawnNode = root.getObjectByName('Spawn_Gallery');
  if (!spawnNode) throw new Error('The gallery has no Spawn_Gallery marker.');
  if (solids.length === 0)
    throw new Error('The gallery has no COL_ collision proxies.');
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
      const materials = new Set<Material>();
      root.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        node.geometry.dispose();
        for (const material of [node.material].flat()) materials.add(material);
      });
      for (const material of materials) material.dispose();
    },
  };
}

export async function loadGallery() {
  const gltf = await new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}models/gallery.glb`,
  );
  return createGallery(gltf.scene);
}
