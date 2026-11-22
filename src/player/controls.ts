import type { PerspectiveCamera } from 'three';

const heldKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
]);
const LOOK_SPEED = 0.002;
// Arrow-key look speed in radians per second.
const TURN_SPEED = 1.8;
const MAX_PITCH = (85 * Math.PI) / 180;

export function bindControls(
  canvas: HTMLCanvasElement,
  camera: PerspectiveCamera,
  startButton: HTMLButtonElement,
  message: HTMLElement,
  onActiveChange: (active: boolean) => void,
  interact: () => void,
) {
  const held = new Set<string>();
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let active = false;
  let requested = false;
  let pitch = 0;
  let lookScale = 1;
  // Start from the spawn heading the renderer set on the camera.
  let yaw = camera.rotation.y;

  function pause() {
    const wasActive = active;
    requested = false;
    active = false;
    held.clear();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    if (wasActive) {
      onActiveChange(false);
      startButton.textContent = 'Resume walk';
      startButton.focus({ preventScroll: true });
    }
  }

  // Without pointer capture (refused, as Firefox does for keyboard activation,
  // or unsupported), the walk continues with the arrow keys for looking.
  function startWithoutCapture(reason: string) {
    requested = false;
    message.textContent = `${reason} Arrow keys look around · Esc to pause`;
    active = true;
    onActiveChange(true);
  }

  function lockError() {
    if (!requested || document.pointerLockElement === canvas) return;
    startWithoutCapture('Mouse capture is unavailable.');
  }

  function syncLock() {
    if (
      document.pointerLockElement !== canvas ||
      !requested ||
      document.hidden
    ) {
      pause();
      return;
    }
    if (active) return;
    active = true;
    onActiveChange(true);
  }

  startButton.addEventListener(
    'click',
    () => {
      if (requested || active) return;
      if (typeof canvas.requestPointerLock !== 'function') {
        startWithoutCapture('This browser does not support mouse capture.');
        return;
      }
      message.textContent =
        'WASD to move · Mouse or arrow keys to look · Esc to pause';
      requested = true;
      try {
        void Promise.resolve(canvas.requestPointerLock()).catch(lockError);
      } catch {
        lockError();
      }
    },
    options,
  );

  document.addEventListener('pointerlockchange', syncLock, options);
  document.addEventListener('pointerlockerror', lockError, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) pause();
    },
    options,
  );
  window.addEventListener('blur', pause, options);
  canvas.addEventListener('webglcontextlost', pause, options);

  document.addEventListener(
    'keydown',
    (event) => {
      if (!active) return;
      if (event.code === 'Escape') {
        pause();
        return;
      }
      if (heldKeys.has(event.code)) {
        event.preventDefault();
        if (!event.repeat) held.add(event.code);
      }
      if (event.code === 'KeyE' && !event.repeat) interact();
    },
    options,
  );
  document.addEventListener(
    'keyup',
    (event) => held.delete(event.code),
    options,
  );
  document.addEventListener(
    'mousemove',
    (event) => {
      if (!active) return;
      yaw = (yaw - event.movementX * LOOK_SPEED * lookScale) % (2 * Math.PI);
      pitch = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, pitch - event.movementY * LOOK_SPEED * lookScale),
      );
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    options,
  );
  canvas.addEventListener(
    'mousedown',
    (event) => {
      if (active && event.button === 0) interact();
    },
    options,
  );

  return {
    get active() {
      return active;
    },
    pause,
    setLookScale(scale: number) {
      lookScale = scale;
    },
    look(seconds: number) {
      const turn =
        Number(held.has('ArrowLeft')) - Number(held.has('ArrowRight'));
      const tilt = Number(held.has('ArrowUp')) - Number(held.has('ArrowDown'));
      if (!turn && !tilt) return;
      const step = TURN_SPEED * lookScale * seconds;
      yaw = (yaw + turn * step) % (2 * Math.PI);
      pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch + tilt * step));
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    movement(distance: number) {
      const forward = Number(held.has('KeyW')) - Number(held.has('KeyS'));
      const right = Number(held.has('KeyD')) - Number(held.has('KeyA'));
      const scale = distance / (Math.hypot(forward, right) || 1);
      return {
        x: (right * Math.cos(yaw) - forward * Math.sin(yaw)) * scale,
        z: (-right * Math.sin(yaw) - forward * Math.cos(yaw)) * scale,
      };
    },
    dispose() {
      pause();
      listeners.abort();
    },
  };
}
