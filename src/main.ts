import './style.css';
import { startRenderer } from './core/renderer';
import { loadExhibits } from './exhibition/manifest';

async function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  const status = document.querySelector<HTMLParagraphElement>('#status');

  const overlay = document.querySelector<HTMLElement>('#controls');
  const startButton = document.querySelector<HTMLButtonElement>('#start-walk');
  const instructions = document.querySelector<HTMLElement>('#instructions');
  const crosshair = document.querySelector<HTMLElement>('#crosshair');
  const prompt = document.querySelector<HTMLElement>('#interaction');

  if (
    !canvas ||
    !status ||
    !overlay ||
    !startButton ||
    !instructions ||
    !crosshair ||
    !prompt
  )
    throw new Error('The preview markup is missing.');

  try {
    const exhibits = await loadExhibits();
    const dispose = startRenderer(
      canvas,
      overlay,
      startButton,
      instructions,
      crosshair,
      prompt,
    );
    if (import.meta.hot) import.meta.hot.dispose(dispose);
    canvas.dataset.exhibitCount = String(exhibits.length);
    status.hidden = true;
  } catch (error) {
    console.error('Virtual Exhibition could not start.', error);
    status.textContent =
      'Could not load the preview. Check that WebGL 2 is available and try reloading.';
  }
}

void start();
