import type { Exhibit } from '../types/exhibit';

// The 2D directory needs no WebGL. Manifest text is set as text, never markup.
function entry(
  exhibit: Exhibit,
  slot: number,
  readEssay: (e: Exhibit) => void,
) {
  const item = document.createElement('li');
  const article = document.createElement('article');
  const heading = document.createElement('h2');
  const headingId = `exhibit-${slot}`;
  heading.id = headingId;
  heading.textContent = exhibit.title;
  article.setAttribute('aria-labelledby', headingId);
  const place = document.createElement('p');
  place.className = 'directory-slot';
  place.textContent = `Display ${String(slot).padStart(2, '0')}`;
  article.append(place, heading);

  if (exhibit.image) {
    const image = document.createElement('img');
    image.src = `${import.meta.env.BASE_URL}${exhibit.image}`;
    image.alt = exhibit.title;
    image.loading = 'lazy';
    article.append(image);
  }
  const description = document.createElement('p');
  description.textContent = exhibit.description;
  article.append(description);

  const actions = document.createElement('p');
  actions.className = 'directory-actions';
  if (exhibit.pdf) {
    const read = document.createElement('button');
    read.type = 'button';
    read.textContent = 'Read the essay';
    read.setAttribute('aria-describedby', headingId);
    read.addEventListener('click', () => readEssay(exhibit));
    const file = document.createElement('a');
    file.href = `${import.meta.env.BASE_URL}${exhibit.pdf}`;
    file.textContent = 'Open PDF file';
    file.setAttribute('aria-describedby', headingId);
    actions.append(read, file);
  } else {
    actions.textContent = 'No essay yet.';
  }
  article.append(actions);
  item.append(article);
  return item;
}

export function renderDirectory(
  list: HTMLOListElement,
  exhibits: readonly Exhibit[],
  readEssay: (exhibit: Exhibit) => void,
) {
  list.replaceChildren(
    ...exhibits.map((exhibit, index) => entry(exhibit, index + 1, readEssay)),
  );
}
