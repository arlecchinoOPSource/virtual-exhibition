import type { Exhibit } from '../types/exhibit';

const anchorOrder: Exhibit['anchor'][] = [
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
];

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
    throw new Error('The exhibit manifest must contain exactly 12 entries.');
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
      return { anchor, title, description, status, image, pdf };
    }
    if (
      status === 'ready' &&
      isLocalAsset(image, 'artworks') &&
      (pdf === null || (isLocalAsset(pdf, 'essays') && pdf.endsWith('.pdf')))
    ) {
      return { anchor, title, description, status, image, pdf };
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
