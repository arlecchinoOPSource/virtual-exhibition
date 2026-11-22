import {
  Box3,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
} from 'three';

export function createGreybox() {
  const scene = new Scene();
  scene.background = new Color(0x252930);
  const surfaces: Mesh[] = [];
  const solids: Box3[] = [];
  const floor = new MeshStandardMaterial({ color: 0x50545b });
  const wall = new MeshStandardMaterial({ color: 0x999da2 });
  const display = new MeshStandardMaterial({ color: 0x67727d });
  const stairs = new MeshStandardMaterial({ color: 0x7f8f99 });
  const switchMaterial = new MeshStandardMaterial({ color: 0xbd771d });

  function addBox(
    width: number,
    height: number,
    depth: number,
    x: number,
    bottom: number,
    z: number,
    material: MeshStandardMaterial,
  ) {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
    mesh.position.set(x, bottom + height / 2, z);
    scene.add(mesh);
    surfaces.push(mesh);
    return mesh;
  }

  // The visible primitive meshes also define the static collision proxies.
  addBox(8, 0.16, 12, 0, -0.16, 0, floor);
  for (const x of [-3.92, 3.92]) addBox(0.16, 3.2, 12, x, 0, 0, wall);
  for (const z of [-5.92, 5.92]) addBox(8, 3.2, 0.16, 0, 0, z, wall);
  addBox(1.3, 1.85, 1, 0, 0, -2.8, display);

  for (let index = 0; index < 5; index++) {
    addBox(
      1.65,
      (index + 1) * 0.18,
      0.38,
      2.15,
      0,
      -0.9 - index * 0.38,
      stairs,
    );
  }
  addBox(1.65, 0.9, 1.2, 2.15, 0, -3.21, stairs);

  scene.updateMatrixWorld(true);
  for (const mesh of surfaces) solids.push(new Box3().setFromObject(mesh));
  const target = addBox(0.34, 0.28, 0.06, 0, 1.51, -2.27, switchMaterial);
  target.updateMatrixWorld();

  const keyLight = new DirectionalLight(0xf6f3ee, 2.1);
  keyLight.position.set(2, 5, 3);
  scene.add(keyLight, new HemisphereLight(0xe7edf6, 0x43464d, 1.4));

  return {
    scene,
    solids,
    surfaces,
    target,
    spawn: { feet: new Vector3(0, 0, 4.2), yaw: 0 },
    setDisplayLight(on: boolean) {
      switchMaterial.emissive.setHex(on ? 0x33b384 : 0x000000);
      switchMaterial.color.setHex(on ? 0x42aa81 : 0xbd771d);
    },
    dispose() {
      for (const mesh of surfaces) mesh.geometry.dispose();
      for (const material of [floor, wall, display, stairs, switchMaterial])
        material.dispose();
    },
  };
}
