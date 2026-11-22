import type { Exhibit } from '../types/exhibit';

// The modal exhibit details. Manifest text is set as text, never as markup.
export function createDetails(dialog: HTMLDialogElement, onClose: () => void) {
  const title = dialog.querySelector('h2');
  const image = dialog.querySelector('img');
  const description = dialog.querySelector('p');
  const essay = dialog.querySelector('a');
  const close = dialog.querySelector('button');
  if (!title || !image || !description || !essay || !close)
    throw new Error('The exhibit details markup is missing.');

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', onClose);

  return {
    open(exhibit: Exhibit) {
      title.textContent = exhibit.title;
      description.textContent = exhibit.description;
      image.hidden = !exhibit.image;
      image.alt = exhibit.image ? exhibit.title : '';
      if (exhibit.image)
        image.src = `${import.meta.env.BASE_URL}${exhibit.image}`;
      else image.removeAttribute('src');
      // shortcut: the essay opens in a new tab until the PDF.js viewer (#14) lands.
      essay.hidden = !exhibit.pdf;
      if (exhibit.pdf) essay.href = `${import.meta.env.BASE_URL}${exhibit.pdf}`;
      else essay.removeAttribute('href');
      dialog.showModal();
    },
  };
}
