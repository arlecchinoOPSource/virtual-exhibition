import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';

export function renderPreview(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const scene = new Scene();
  scene.background = new Color(0x202831);

  const camera = new PerspectiveCamera(45, 1, 0.1, 40);
  camera.position.set(4, 3, 6);
  camera.lookAt(0, 0.5, 0);

  const keyLight = new DirectionalLight(0xfff3dd, 3);
  keyLight.position.set(3, 5, 2);
  scene.add(keyLight, new HemisphereLight(0xddeeff, 0x4f4540, 1.6));

  const floor = new Mesh(
    new PlaneGeometry(12, 12),
    new MeshStandardMaterial({ color: 0x45515a }),
  );
  floor.rotation.x = -Math.PI / 2;
  const box = new Mesh(
    new BoxGeometry(1.2, 1.2, 1.2),
    new MeshStandardMaterial({ color: 0xc1a174 }),
  );
  box.position.set(-0.85, 0.6, 0);
  box.rotation.y = 0.25;
  const sphere = new Mesh(
    new SphereGeometry(0.6, 32, 20),
    new MeshStandardMaterial({ color: 0x779cb1 }),
  );
  sphere.position.set(0.9, 0.6, 0);
  scene.add(floor, box, sphere);

  function draw() {
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  draw();
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  const onContextRestored = () => requestAnimationFrame(draw);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  return () => {
    observer.disconnect();
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    for (const mesh of [floor, box, sphere]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    renderer.dispose();
  };
}
