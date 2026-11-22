import { describe, expect, it } from 'vitest';
import manifest from '../../public/data/exhibits.json';
import { parseExhibits } from '../../src/exhibition/manifest';

describe('exhibit manifest', () => {
  it('reserves 12 ordered locations and keeps the Doraemon assets pending', () => {
    const entries = parseExhibits(manifest);
    expect(entries).toHaveLength(12);
    expect(entries[0]).toMatchObject({
      anchor: 'Exhibit_01',
      title: 'Doraemon academic essay',
      status: 'awaiting-assets',
      image: null,
      pdf: null,
    });
    expect(
      entries.slice(1).every((entry) => entry.status === 'placeholder'),
    ).toBe(true);
  });

  it('rejects missing or duplicate anchors', () => {
    expect(() => parseExhibits(manifest.slice(1))).toThrow(/12 entries/);
    expect(() =>
      parseExhibits([manifest[0], ...manifest.slice(0, 11)]),
    ).toThrow(/Exhibit_02/);
  });

  it('rejects external asset references and accepts local published assets', () => {
    const ready = {
      ...manifest[0],
      status: 'ready',
      image: 'artworks/cover.webp',
      pdf: 'essays/essay.pdf',
    };
    expect(parseExhibits([ready, ...manifest.slice(1)])[0]).toMatchObject(
      ready,
    );
    expect(() =>
      parseExhibits([
        { ...ready, pdf: 'https://example.com/essay.pdf' },
        ...manifest.slice(1),
      ]),
    ).toThrow(/assets/);
  });
});
