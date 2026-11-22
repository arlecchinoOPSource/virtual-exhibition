import { PerspectiveCamera, WebGLRenderer } from 'three';
import type { Box3, Object3D, Scene, Vector3 } from 'three';
import { stepBody } from '../player/collision';
import { bindControls } from '../player/controls';
import { createSurfacePicker } from '../player/interaction';
import type { Exhibit } from '../types/exhibit';

const STEP = 1 / 120;
const SPEED = 3.2;
const EYE_HEIGHT = 1.65;

export interface World {
  scene: Scene;
  solids: readonly Box3[];
  surfaces: Object3D[];
  spawn: { feet: Vector3; yaw: number };
  target?: Object3D;
  setDisplayLight?: (on: boolean) => void;
  exhibitAt?: (object: Object3D | undefined) => Exhibit | undefined;
  actionAt?: (
    object: Object3D | undefined,
    feet: Vector3,
  ) => { label: string; run(): void } | undefined;
  update?: (seconds: number, feet: Vector3) => void;
  dispose(): void;
}

export function startRenderer(
  world: World,
  canvas: HTMLCanvasElement,
  overlay: HTMLElement,
  startButton: HTMLButtonElement,
  instructions: HTMLElement,
  crosshair: HTMLElement,
  prompt: HTMLElement,
  label: HTMLElement,
  openExhibit: (exhibit: Exhibit) => void,
) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const camera = new PerspectiveCamera(60, 1, 0.05, 40);
  const body = { feet: world.spawn.feet.clone(), fallSpeed: 0, grounded: true };
  camera.position.copy(body.feet);
  camera.position.y += EYE_HEIGHT;
  camera.rotation.set(0, world.spawn.yaw, 0, 'YXZ');
  const pick = createSurfacePicker(camera, world.surfaces, 3);
  const [labelTitle, labelDescription] = label.children;
  let shownExhibit: Exhibit | undefined;
  let lightOn = false;
  let previousTime: number | undefined;
  let accumulator = 0;

  function updatePrompt() {
    const hit = controls.active ? pick() : undefined;
    const exhibit = world.exhibitAt?.(hit);
    const sceneAction = world.actionAt?.(hit, body.feet);
    const action = lightOn ? 'Turn display light off' : 'Turn display light on';
    const text =
      world.target && hit === world.target
        ? `E / Click · ${action}`
        : sceneAction
          ? sceneAction.label
          : exhibit
            ? 'E / Click · View details'
            : '';
    if (prompt.textContent !== text) prompt.textContent = text;

    // Manifest text goes into the DOM as plain text, never as markup.
    if (exhibit === shownExhibit) return;
    shownExhibit = exhibit;
    if (labelTitle) labelTitle.textContent = exhibit?.title ?? '';
    if (labelDescription)
      labelDescription.textContent = exhibit?.description ?? '';
    label.hidden = !exhibit;
  }

  const controls = bindControls(
    canvas,
    camera,
    startButton,
    instructions,
    (active) => {
      overlay.hidden = active;
      crosshair.hidden = !active;
      previousTime = undefined;
      accumulator = 0;
      updatePrompt();
    },
    () => {
      const hit = pick();
      if (world.target && hit === world.target) {
        lightOn = !lightOn;
        world.setDisplayLight?.(lightOn);
        updatePrompt();
        return;
      }
      const sceneAction = world.actionAt?.(hit, body.feet);
      if (sceneAction) {
        sceneAction.run();
        updatePrompt();
        return;
      }
      const exhibit = world.exhibitAt?.(hit);
      if (!exhibit) return;
      // Pausing releases pointer lock and clears held keys; the pose stays.
      controls.pause();
      openExhibit(exhibit);
    },
  );

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function draw(time: number) {
    if (controls.active) {
      accumulator += Math.min((time - (previousTime ?? time)) / 1000, 0.1);
      previousTime = time;
      while (accumulator >= STEP) {
        const { x, z } = controls.movement(SPEED * STEP);
        world.update?.(STEP, body.feet);
        stepBody(body, x, z, STEP, world.solids);
        accumulator -= STEP;
      }
      camera.position.copy(body.feet);
      camera.position.y += EYE_HEIGHT;
      updatePrompt();
    }
    renderer.render(world.scene, camera);
  }

  function syncLoop() {
    previousTime = undefined;
    accumulator = 0;
    const contextLost = renderer.getContext().isContextLost();
    renderer.setAnimationLoop(document.hidden || contextLost ? null : draw);
  }

  resize();
  if (!document.hidden) draw(0);
  syncLoop();
  overlay.hidden = false;

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', syncLoop);
  canvas.addEventListener('webglcontextlost', syncLoop);
  canvas.addEventListener('webglcontextrestored', syncLoop);

  return () => {
    controls.dispose();
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', syncLoop);
    canvas.removeEventListener('webglcontextlost', syncLoop);
    canvas.removeEventListener('webglcontextrestored', syncLoop);
    world.dispose();
    renderer.dispose();
  };
}
