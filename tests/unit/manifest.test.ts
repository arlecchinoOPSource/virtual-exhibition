import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../../public/data/exhibits.json';
import {
  anchorOrder,
  basementAnchors,
  galleryAnchors,
  parseExhibits,
  sectionOf,
} from '../../src/exhibition/manifest';

describe('exhibit manifest', () => {
  it('reserves 18 ordered locations and publishes the Doraemon essay', () => {
    const entries = parseExhibits(manifest);
    expect(entries).toHaveLength(18);
    expect(entries[0]).toMatchObject({
      anchor: 'Exhibit_01',
      section: 'studio',
      status: 'ready',
      image: 'artworks/doraemon-filipino.webp',
      pdf: 'essays/doraemon-filipino.pdf',
    });
    for (const path of [entries[0]?.image, entries[0]?.pdf])
      expect(existsSync(`public/${path}`), path ?? '').toBe(true);
    expect(
      entries.slice(1).every((entry) => entry.status === 'placeholder'),
    ).toBe(true);
  });

  it('rejects missing or duplicate anchors', () => {
    expect(() => parseExhibits(manifest.slice(1))).toThrow(/18 entries/);
    expect(() =>
      parseExhibits([manifest[0], ...manifest.slice(0, 17)]),
    ).toThrow(/Exhibit_02/);
  });

  it('places every slot in the section the accepted layout gives it', () => {
    const plan = JSON.parse(
      readFileSync('assets-source/layout/redesign.json', 'utf8'),
    ) as { frames: { slot: string; section: string }[] };
    expect(plan.frames.map((frame) => frame.slot)).toEqual(anchorOrder);
    for (const frame of plan.frames)
      expect(sectionOf[frame.slot as keyof typeof sectionOf], frame.slot).toBe(
        frame.section,
      );
    const counts = new Map<string, number>();
    for (const anchor of anchorOrder)
      counts.set(sectionOf[anchor], (counts.get(sectionOf[anchor]) ?? 0) + 1);
    expect([...counts.values()]).toEqual([3, 3, 3, 3, 3, 3]);
    expect(galleryAnchors).toHaveLength(15);
    expect(basementAnchors).toEqual(['Exhibit_16', 'Exhibit_17', 'Exhibit_18']);
    // Placeholder titles stay neutral: no section names in them.
    for (const entry of parseExhibits(manifest).slice(1))
      expect(entry.title).toMatch(/^Artwork placeholder \d+$/);
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
