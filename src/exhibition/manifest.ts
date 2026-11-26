import type { Exhibit, ExhibitAnchor, Section } from '../types/exhibit';

export const anchorOrder: Exhibit['anchor'][] = [
  'Exhibit_01',
  'Exhibit_02',
  'Exhibit_03',
  'Exhibit_04',
  'Exhibit_05',
  'Exhibit_06',
  'Exhibit_07',
  'Exhibit_08',
  'Exhibit_09',
  'Exhibit_10',
  'Exhibit_11',
  'Exhibit_12',
  'Exhibit_13',
  'Exhibit_14',
  'Exhibit_15',
  'Exhibit_16',
  'Exhibit_17',
  'Exhibit_18',
];

// Where each slot hangs, from the accepted layout (assets-source/layout/
// redesign.json; a unit test keeps the two in step). Content stays bound to
// the slot, never to the section.
export const sectionOf: Record<ExhibitAnchor, Section> = {
  Exhibit_01: 'studio',
  Exhibit_02: 'studio',
  Exhibit_03: 'studio',
  Exhibit_04: 'street',
  Exhibit_05: 'street',
  Exhibit_06: 'street',
  Exhibit_07: 'reading',
  Exhibit_08: 'reading',
  Exhibit_09: 'reading',
  Exhibit_10: 'living',
  Exhibit_11: 'living',
  Exhibit_12: 'living',
  Exhibit_13: 'theater',
  Exhibit_14: 'theater',
  Exhibit_15: 'theater',
  Exhibit_16: 'basement',
  Exhibit_17: 'basement',
  Exhibit_18: 'basement',
};

// Upstairs anchors live in gallery.glb; basement anchors arrive with
// basement.glb, which loads only when the door first opens.
export const galleryAnchors = anchorOrder.filter(
  (anchor) => sectionOf[anchor] !== 'basement',
);
export const basementAnchors = anchorOrder.filter(
  (anchor) => sectionOf[anchor] === 'basement',
);

function isLocalAsset(
  path: unknown,
  directory: 'artworks' | 'essays',
): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith(`${directory}/`) &&
    /^(artworks|essays)\/[\w-]+(?:\.[\w-]+)+$/.test(path)
  );
}

export function parseExhibits(data: unknown): Exhibit[] {
  if (!Array.isArray(data) || data.length !== anchorOrder.length) {
    throw new Error(
      `The exhibit manifest must contain exactly ${anchorOrder.length} entries.`,
    );
  }

  return anchorOrder.map((anchor, index): Exhibit => {
    const entry: unknown = data[index];
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Missing exhibit entry for ${anchor}.`);
    }
    const {
      anchor: entryAnchor,
      title,
      description,
      status,
      image,
      pdf,
    } = entry as Record<string, unknown>;
    if (
      entryAnchor !== anchor ||
      typeof title !== 'string' ||
      !title.trim() ||
      typeof description !== 'string'
    ) {
      throw new Error(`Invalid exhibit details for ${anchor}.`);
    }
    if (
      (status === 'placeholder' || status === 'awaiting-assets') &&
      image === null &&
      pdf === null
    ) {
      return {
        anchor,
        section: sectionOf[anchor],
        title,
        description,
        status,
        image,
        pdf,
      };
    }
    if (
      status === 'ready' &&
      isLocalAsset(image, 'artworks') &&
      (pdf === null || (isLocalAsset(pdf, 'essays') && pdf.endsWith('.pdf')))
    ) {
      return {
        anchor,
        section: sectionOf[anchor],
        title,
        description,
        status,
        image,
        pdf,
      };
    }
    throw new Error(`Invalid exhibit status or assets for ${anchor}.`);
  });
}

export async function loadExhibits(): Promise<Exhibit[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/exhibits.json`);
  if (!response.ok)
    throw new Error(`Exhibit manifest request failed (${response.status}).`);
  return parseExhibits(await response.json());
}
