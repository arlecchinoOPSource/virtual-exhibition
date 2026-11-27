import { unlockGallery } from './gallery-entry';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { spawnAtBasementDoor } from './basement';
import { moveSpawn } from './spawn';

declare global {
  interface Window {
    audioProbe: { contexts: AudioContext[]; gains: GainNode[] };
  }
}

// Records every AudioContext and GainNode the page creates. The first gain is
// the ambience's master volume.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.audioProbe = { contexts: [], gains: [] };
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        window.audioProbe.contexts.push(this);
      }
      createGain() {
        const gain = super.createGain();
        window.audioProbe.gains.push(gain);
        return gain;
      }
    };
  });
});

const contexts = (page: Page) =>
  page.evaluate(() => window.audioProbe.contexts.length);
const masterGain = (page: Page) =>
  page.evaluate(() => window.audioProbe.gains[0]?.gain.value ?? 0);

async function openAudioSettings(page: Page) {
  await page.goto('/');
  await unlockGallery(page);
  await expect(page.locator('#scene')).toHaveAttribute(
    'data-environment',
    'gallery',
  );
  await page.locator('#settings summary').click();
}

// Every request for each radio's track, by URL.
let radioRequests: string[] = [];
let livingRequests: string[] = [];
test.beforeEach(({ page }) => {
  radioRequests = [];
  livingRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('basement-radio'))
      radioRequests.push(request.url());
    if (request.url().includes('living-radio'))
      livingRequests.push(request.url());
  });
});

// Horizontal distance from the Web Audio listener to the radio's emitter.
const radioDistance = (page: Page) =>
  page.evaluate(() => {
    const listener = window.audioProbe.contexts[0]?.listener;
    if (!listener?.positionX) return undefined;
    // The radio's grille in Three.js x, z: (26.4, 3.6).
    return Math.hypot(
      listener.positionX.value - 26.4,
      listener.positionZ.value - 3.6,
    );
  });

test('starts both radios on the first click and keeps them playing on the walk', async ({
  page,
}) => {
  await page.goto('/');
  // Nothing plays, and no track loads, before the visitor's first gesture.
  expect(await contexts(page)).toBe(0);
  await unlockGallery(page);
  const viewport = page.locator('#viewport');
  await page.getByRole('button', { name: 'Start walk' }).click();
  await expect(page.locator('#crosshair')).toBeVisible();
  // Sound is on by default (owner's request), so both sets start at once.
  await expect(viewport).toHaveAttribute('data-radio', 'playing', {
    timeout: 15000,
  });
  await expect(viewport).toHaveAttribute('data-living-radio', 'playing', {
    timeout: 15000,
  });
  // Walking away from both keeps them playing: they never stop by zone.
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  await expect(viewport).toHaveAttribute('data-radio', 'playing');
  await expect(viewport).toHaveAttribute('data-living-radio', 'playing');
  await expect(viewport).toHaveAttribute('data-radio-sources', '1');
  await expect(viewport).toHaveAttribute('data-living-radio-sources', '1');
  expect(radioRequests).toHaveLength(1);
  expect(livingRequests).toHaveLength(1);
});

test('turns sound off and on, then changes the volume and mutes', async ({
  page,
}) => {
  await openAudioSettings(page);
  const viewport = page.locator('#viewport');
  // Sound starts on; switching it off and on again is the visitor's gesture.
  await expect(page.getByLabel('Play environmental sound')).toBeChecked();
  await page.getByLabel('Play environmental sound').uncheck();
  await page.getByLabel('Play environmental sound').check();
  await expect(viewport).toHaveAttribute('data-ambience', 'gallery');
  await expect(viewport).toHaveAttribute('data-ambience-layers', 'gallery');
  expect(await contexts(page)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.audioProbe.contexts[0]?.state))
    .toBe('running');
  await expect.poll(() => masterGain(page)).toBeCloseTo(0.6, 2);

  await page.getByLabel('Volume').fill('0.3');
  await expect(page.locator('#volume-value')).toHaveText('30%');
  await expect.poll(() => masterGain(page)).toBeCloseTo(0.3, 2);

  await page.getByLabel('Mute').check();
  await expect(viewport).toHaveAttribute('data-ambience', 'muted');
  await expect.poll(() => masterGain(page)).toBeLessThan(0.001);
  await page.getByLabel('Mute').uncheck();
  await expect.poll(() => masterGain(page)).toBeCloseTo(0.3, 2);

  // Turning sound off silences it and stops the layer's sources.
  await page.getByLabel('Play environmental sound').uncheck();
  await expect(viewport).toHaveAttribute('data-ambience', 'off');
  await expect.poll(() => masterGain(page)).toBeLessThan(0.001);
  await expect(viewport).toHaveAttribute('data-ambience-layers', '', {
    timeout: 5000,
  });
});

test('switches to the basement ambience below ground and stops the gallery layer', async ({
  page,
}) => {
  await spawnAtBasementDoor(page);
  await openAudioSettings(page);
  const viewport = page.locator('#viewport');
  await page.getByLabel('Play environmental sound').check();
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start walk' }).click();
  await expect(page.locator('#crosshair')).toBeVisible();
  const prompt = page.locator('#interaction');
  await expect(prompt).toHaveText('E / Click · Open the door');
  await page.keyboard.press('e');
  await expect(prompt).toBeEmpty({ timeout: 10000 });

  await page.keyboard.down('w');
  await expect(viewport).toHaveAttribute('data-ambience', 'basement', {
    timeout: 15000,
  });
  await page.keyboard.up('w');
  await expect(viewport).toHaveAttribute('data-ambience-layers', 'basement', {
    timeout: 5000,
  });

  await page.keyboard.down('s');
  await expect(viewport).toHaveAttribute('data-ambience', 'gallery', {
    timeout: 15000,
  });
  await page.keyboard.up('s');
  await expect(viewport).toHaveAttribute('data-ambience-layers', 'gallery', {
    timeout: 5000,
  });
});

test('keeps one basement radio loop playing through the door and the stairs', async ({
  page,
}) => {
  await spawnAtBasementDoor(page);
  await openAudioSettings(page);
  const viewport = page.locator('#viewport');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start walk' }).click();
  await expect(page.locator('#crosshair')).toBeVisible();
  // It plays before the basement loads, from the gallery's anchor for it.
  await expect(viewport).toHaveAttribute('data-radio', 'playing', {
    timeout: 15000,
  });
  const prompt = page.locator('#interaction');
  await expect(prompt).toHaveText('E / Click · Open the door');
  await page.keyboard.press('e');
  await expect(prompt).toBeEmpty({ timeout: 10000 });

  await page.keyboard.down('w');
  await expect(viewport).toHaveAttribute('data-ambience', 'basement', {
    timeout: 15000,
  });
  const far = await radioDistance(page);
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  // The listener follows the visitor: walking in brings the set closer.
  const near = await radioDistance(page);
  if (far !== undefined && near !== undefined) expect(near).toBeLessThan(far);

  // Climbing back out keeps the same single source playing.
  await page.keyboard.down('s');
  await expect(viewport).toHaveAttribute('data-ambience', 'gallery', {
    timeout: 15000,
  });
  await page.keyboard.up('s');
  await expect(viewport).toHaveAttribute('data-radio', 'playing');
  await expect(viewport).toHaveAttribute('data-radio-sources', '1');
  expect(radioRequests).toHaveLength(1);
});

test("plays the living room's radio copy while the visitor is in that room", async ({
  page,
}) => {
  // Between the coffee table and the couch, facing the TV and the radio.
  await moveSpawn(page, [-11.85, 0, 7.6], [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  await openAudioSettings(page);
  const viewport = page.locator('#viewport');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start walk' }).click();
  await expect(page.locator('#crosshair')).toBeVisible();
  await expect(viewport).toHaveAttribute('data-living-radio', 'playing', {
    timeout: 15000,
  });
  await expect(viewport).toHaveAttribute('data-living-radio-sources', '1');
  // One source and one fetch for its track.
  expect(livingRequests).toHaveLength(1);
});
