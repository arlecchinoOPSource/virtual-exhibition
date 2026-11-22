import type { PerspectiveCamera } from 'three';

const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const LOOK_SPEED = 0.002;
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

  function lockError() {
    if (!requested || document.pointerLockElement === canvas) return;
    requested = false;
    message.textContent =
      'Mouse capture failed. Select the button to try again.';
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
        message.textContent = 'This browser does not support mouse capture.';
        return;
      }
      message.textContent = 'WASD to move · Mouse to look · Esc to pause';
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
      if (movementKeys.has(event.code)) {
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
      yaw = (yaw - event.movementX * LOOK_SPEED) % (2 * Math.PI);
      pitch = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, pitch - event.movementY * LOOK_SPEED),
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
