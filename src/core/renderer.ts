import { PerspectiveCamera, WebGLRenderer } from 'three';
import { createGreybox } from '../environments/greybox';

export function startRenderer(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const { scene, dispose } = createGreybox();
  const camera = new PerspectiveCamera(60, 1, 0.05, 40);
  // Leave the camera facing straight down -Z from its standing eye height.
  camera.position.set(0, 1.65, 4.2);

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function draw() {
    renderer.render(scene, camera);
  }

  function syncLoop() {
    const contextLost = renderer.getContext().isContextLost();
    renderer.setAnimationLoop(document.hidden || contextLost ? null : draw);
  }

  resize();
  if (!document.hidden) draw();
  syncLoop();

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', syncLoop);
  canvas.addEventListener('webglcontextlost', syncLoop);
  canvas.addEventListener('webglcontextrestored', syncLoop);

  return () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', syncLoop);
    canvas.removeEventListener('webglcontextlost', syncLoop);
    canvas.removeEventListener('webglcontextrestored', syncLoop);
    dispose();
    renderer.dispose();
  };
}
