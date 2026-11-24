import './style.css';
import { loadExhibits } from './exhibition/manifest';
import { renderDirectory } from './ui/directory-list';
import { createViewer } from './ui/viewer';

async function start() {
  const status = document.querySelector<HTMLElement>('#status');
  const list = document.querySelector<HTMLOListElement>('#exhibits');
  const dialog = document.querySelector<HTMLDialogElement>('#essay-viewer');
  if (!status || !list || !dialog)
    throw new Error('The directory markup is missing.');
  try {
    const { open } = createViewer(dialog);
    const exhibits = await loadExhibits();
    renderDirectory(list, exhibits, open);
    status.hidden = true;
  } catch (error) {
    console.error('The exhibition directory could not load.', error);
    status.textContent = 'Could not load the exhibits. Try reloading the page.';
  }
}

void start();
