import { Raycaster, Vector2 } from 'three';
import type { Camera, Object3D } from 'three';

export function createTargetPicker(
  camera: Camera,
  surfaces: Object3D[],
  target: Object3D,
  range: number,
) {
  const raycaster = new Raycaster();
  raycaster.far = range;
  const screenCenter = new Vector2();
  return () => {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(screenCenter, camera);
    return raycaster.intersectObjects(surfaces, false)[0]?.object === target;
  };
}
