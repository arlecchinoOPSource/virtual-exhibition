import './style.css';
import { startRenderer } from './core/renderer';
import { loadExhibits } from './exhibition/manifest';

const canvas = document.querySelector<HTMLCanvasElement>('#scene');
const status = document.querySelector<HTMLParagraphElement>('#status');

if (!canvas || !status) throw new Error('The preview markup is missing.');

async function start(canvas: HTMLCanvasElement, status: HTMLParagraphElement) {
  try {
    const exhibits = await loadExhibits();
    const dispose = startRenderer(canvas);
    if (import.meta.hot) import.meta.hot.dispose(dispose);
    canvas.dataset.exhibitCount = String(exhibits.length);
    status.hidden = true;
  } catch (error) {
    console.error('Virtual Exhibition could not start.', error);
    status.textContent =
      'Could not load the preview. Check that WebGL 2 is available and try reloading.';
  }
}

void start(canvas, status);
