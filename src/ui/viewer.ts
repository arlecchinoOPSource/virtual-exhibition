import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import type { Exhibit } from '../types/exhibit';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const DEFAULT_ZOOM = ZOOMS.indexOf(1);

// PDF.js and its worker load only when a visitor first opens an essay.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | undefined;
function loadPdfJs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

export function createViewer(dialog: HTMLDialogElement) {
  function part<T extends Element>(selector: string) {
    const element = dialog.querySelector<T>(selector);
    if (!element) throw new Error(`The essay viewer is missing ${selector}.`);
    return element;
  }
  const title = part<HTMLHeadingElement>('h2');
  const zoomLabel = part<HTMLOutputElement>('output');
  const status = part<HTMLElement>('.viewer-status');
  const pages = part<HTMLElement>('.viewer-pages');
  const file = part<HTMLAnchorElement>('a');
  const zoomOut = part<HTMLButtonElement>('[data-zoom="-1"]');
  const zoomIn = part<HTMLButtonElement>('[data-zoom="1"]');
  const close = part<HTMLButtonElement>('[data-close]');

  let zoomIndex = DEFAULT_ZOOM;
  let loading: PDFDocumentLoadingTask | undefined;
  let tasks: RenderTask[] = [];
  // Each render or close bumps the generation so stale async work stops.
  let generation = 0;
  let opener: HTMLElement | null = null;

  function stop() {
    generation++;
    for (const task of tasks) task.cancel();
    tasks = [];
  }

  function fail(error: unknown) {
    if (!dialog.open) return;
    console.error('The essay could not be loaded.', error);
    status.textContent =
      'The essay could not be loaded. Use Open PDF file instead.';
  }

  async function render() {
    stop();
    const current = generation;
    const doc = await loading?.promise;
    if (!doc || current !== generation) return;

    const zoom = ZOOMS[zoomIndex] ?? 1;
    zoomLabel.value = `${Math.round(zoom * 100)}%`;
    zoomOut.disabled = zoomIndex === 0;
    zoomIn.disabled = zoomIndex === ZOOMS.length - 1;
    const pixelRatio = window.devicePixelRatio || 1;
    const fitWidth = pages.clientWidth - 32;
    // Keep the reading position when the zoom changes.
    const position = pages.scrollHeight
      ? pages.scrollTop / pages.scrollHeight
      : 0;

    const sheets = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      if (current !== generation) return;
      const scale = (zoom * fitWidth) / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale: scale * pixelRatio });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Page ${number} of ${doc.numPages}`);
      sheets.push({ page, canvas, viewport });
    }
    pages.replaceChildren(...sheets.map((sheet) => sheet.canvas));
    pages.scrollTop = position * pages.scrollHeight;

    for (const { page, canvas, viewport } of sheets) {
      const task = page.render({ canvas, viewport });
      tasks.push(task);
      try {
        await task.promise;
      } catch (error) {
        if (current !== generation) return;
        throw error;
      }
    }
    pages.dataset.renderedZoom = String(zoom);
  }

  function setZoom(index: number) {
    const next = Math.max(0, Math.min(ZOOMS.length - 1, index));
    if (next === zoomIndex || !loading) return;
    zoomIndex = next;
    render().catch(fail);
  }

  zoomOut.addEventListener('click', () => setZoom(zoomIndex - 1));
  zoomIn.addEventListener('click', () => setZoom(zoomIndex + 1));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') setZoom(zoomIndex + 1);
    else if (event.key === '-') setZoom(zoomIndex - 1);
    else if (event.key === '0') setZoom(DEFAULT_ZOOM);
  });
  dialog.addEventListener('close', () => {
    stop();
    void loading?.destroy();
    loading = undefined;
    pages.replaceChildren();
    delete pages.dataset.renderedZoom;
    opener?.focus();
  });

  return {
    open(exhibit: Exhibit) {
      if (!exhibit.pdf) return;
      opener =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const url = `${import.meta.env.BASE_URL}${exhibit.pdf}`;
      title.textContent = exhibit.title;
      file.href = url;
      status.textContent = 'Loading the essay…';
      zoomIndex = DEFAULT_ZOOM;
      dialog.showModal();
      pages.focus();

      loadPdfJs()
        .then(async (pdfjs) => {
          if (!dialog.open) return;
          loading = pdfjs.getDocument(url);
          await render();
          if (dialog.open) status.textContent = '';
        })
        .catch(fail);
    },
  };
}
