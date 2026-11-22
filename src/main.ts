import './style.css';
import { startRenderer } from './core/renderer';
import { loadGallery } from './environments/gallery';
import { createGreybox } from './environments/greybox';
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
    // The greybox stays available as a traversal and interaction test room.
    const useGreybox =
      new URLSearchParams(location.search).get('env') === 'greybox';
    const world = useGreybox ? createGreybox() : await loadGallery();
    canvas.dataset.environment = useGreybox ? 'greybox' : 'gallery';
    const dispose = startRenderer(
      world,
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
