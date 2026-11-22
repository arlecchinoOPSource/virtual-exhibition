import { Raycaster, Vector2 } from 'three';
import type { Camera, Object3D } from 'three';

// Returns the first surface under the crosshair within range, if any.
export function createSurfacePicker(
  camera: Camera,
  surfaces: Object3D[],
  range: number,
) {
  const raycaster = new Raycaster();
  raycaster.far = range;
  const screenCenter = new Vector2();
  return () => {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(screenCenter, camera);
    return raycaster.intersectObjects(surfaces, false)[0]?.object;
  };
}

export function createTargetPicker(
  camera: Camera,
  surfaces: Object3D[],
  target: Object3D,
  range: number,
) {
  const pick = createSurfacePicker(camera, surfaces, range);
  return () => pick() === target;
}
