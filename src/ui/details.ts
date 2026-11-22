import type { Exhibit } from '../types/exhibit';

// The modal exhibit details. Manifest text is set as text, never as markup.
export function createDetails(
  dialog: HTMLDialogElement,
  onClose: () => void,
  readEssay: (exhibit: Exhibit) => void,
) {
  const title = dialog.querySelector('h2');
  const image = dialog.querySelector('img');
  const description = dialog.querySelector('p');
  const essay = dialog.querySelector<HTMLButtonElement>('[data-essay]');
  const close = dialog.querySelector<HTMLButtonElement>('[data-close]');
  if (!title || !image || !description || !essay || !close)
    throw new Error('The exhibit details markup is missing.');
  let shown: Exhibit | undefined;

  essay.addEventListener('click', () => {
    if (shown) readEssay(shown);
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', onClose);

  return {
    open(exhibit: Exhibit) {
      shown = exhibit;
      title.textContent = exhibit.title;
      description.textContent = exhibit.description;
      image.hidden = !exhibit.image;
      image.alt = exhibit.image ? exhibit.title : '';
      if (exhibit.image)
        image.src = `${import.meta.env.BASE_URL}${exhibit.image}`;
      else image.removeAttribute('src');
      essay.hidden = !exhibit.pdf;
      dialog.showModal();
    },
  };
}
