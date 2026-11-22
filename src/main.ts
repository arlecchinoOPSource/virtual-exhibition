import './style.css';
import { startRenderer } from './core/renderer';
import { loadGallery } from './environments/gallery';
import { createGreybox } from './environments/greybox';
import { loadExhibits } from './exhibition/manifest';
import { createDetails } from './ui/details';
import { createViewer } from './ui/viewer';

async function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene');
  const status = document.querySelector<HTMLParagraphElement>('#status');

  const overlay = document.querySelector<HTMLElement>('#controls');
  const startButton = document.querySelector<HTMLButtonElement>('#start-walk');
  const instructions = document.querySelector<HTMLElement>('#instructions');
  const crosshair = document.querySelector<HTMLElement>('#crosshair');
  const prompt = document.querySelector<HTMLElement>('#interaction');
  const label = document.querySelector<HTMLElement>('#exhibit-label');
  const dialog = document.querySelector<HTMLDialogElement>('#exhibit-details');
  const viewer = document.querySelector<HTMLDialogElement>('#essay-viewer');

  if (
    !canvas ||
    !status ||
    !overlay ||
    !startButton ||
    !instructions ||
    !crosshair ||
    !prompt ||
    !label ||
    !dialog ||
    !viewer
  )
    throw new Error('The preview markup is missing.');

  try {
    const exhibits = await loadExhibits();
    // The greybox stays available as a traversal and interaction test room.
    const useGreybox =
      new URLSearchParams(location.search).get('env') === 'greybox';
    const world = useGreybox ? createGreybox() : await loadGallery(exhibits);
    canvas.dataset.environment = useGreybox ? 'greybox' : 'gallery';
    const dispose = startRenderer(
      world,
      canvas,
      overlay,
      startButton,
      instructions,
      crosshair,
      prompt,
      label,
      // Closing the details leaves the visitor paused on Resume walk.
      createDetails(
        dialog,
        () => startButton.focus(),
        createViewer(viewer).open,
      ).open,
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
