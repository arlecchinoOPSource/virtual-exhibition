import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from 'three';

export function createGreybox() {
  const scene = new Scene();
  scene.background = new Color(0x252930);

  // Dimensions are in meters, with the finished floor at y = 0.
  const floorGeometry = new BoxGeometry(8, 0.16, 12);
  const sideGeometry = new BoxGeometry(0.16, 3.2, 12);
  const endGeometry = new BoxGeometry(8, 3.2, 0.16);
  const plinthGeometry = new BoxGeometry(1.3, 1.05, 1);
  const floorMaterial = new MeshStandardMaterial({ color: 0x50545b });
  const wallMaterial = new MeshStandardMaterial({ color: 0x999da2 });
  const plinthMaterial = new MeshStandardMaterial({ color: 0x67727d });

  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.position.y = -0.08;
  scene.add(floor);

  for (const x of [-3.92, 3.92]) {
    const wall = new Mesh(sideGeometry, wallMaterial);
    wall.position.set(x, 1.6, 0);
    scene.add(wall);
  }
  for (const z of [-5.92, 5.92]) {
    const wall = new Mesh(endGeometry, wallMaterial);
    wall.position.set(0, 1.6, z);
    scene.add(wall);
  }

  const plinth = new Mesh(plinthGeometry, plinthMaterial);
  plinth.position.set(0, 0.525, -2.8);
  const keyLight = new DirectionalLight(0xf6f3ee, 2.1);
  keyLight.position.set(2, 5, 3);
  scene.add(plinth, keyLight, new HemisphereLight(0xe7edf6, 0x43464d, 1.4));

  return {
    scene,
    dispose() {
      for (const geometry of [
        floorGeometry,
        sideGeometry,
        endGeometry,
        plinthGeometry,
      ]) {
        geometry.dispose();
      }
      for (const material of [floorMaterial, wallMaterial, plinthMaterial]) {
        material.dispose();
      }
    },
  };
}
