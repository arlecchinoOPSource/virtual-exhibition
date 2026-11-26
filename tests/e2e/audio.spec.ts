import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { spawnAtBasementDoor } from './basement';

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
  await expect(page.locator('#scene')).toHaveAttribute(
    'data-environment',
    'gallery',
  );
  await page.locator('#settings summary').click();
}

// Every request for the radio's track, by URL.
let radioRequests: string[] = [];
test.beforeEach(({ page }) => {
  radioRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('radio-placeholder'))
      radioRequests.push(request.url());
  });
});

// Horizontal distance from the Web Audio listener to the radio's emitter.
const radioDistance = (page: Page) =>
  page.evaluate(() => {
    const listener = window.audioProbe.contexts[0]?.listener;
    if (!listener?.positionX) return undefined;
    // The radio's grille in Three.js x, z: (26.4, 3.6) in the basement's
    // original frame, placed by the plan's basement_transform (#87).
    return Math.hypot(
      listener.positionX.value - 3.4,
      listener.positionZ.value - 18.4,
    );
  });

test('plays nothing on load or during the walk until the visitor opts in', async ({
  page,
}) => {
  await openAudioSettings(page);
  const viewport = page.locator('#viewport');
  await expect(viewport).toHaveAttribute('data-ambience', 'off');
  await page.getByRole('button', { name: 'Start walk' }).click();
  await page.waitForTimeout(800);
  expect(await contexts(page)).toBe(0);
  await expect(viewport).toHaveAttribute('data-ambience', 'off');
  expect(radioRequests).toEqual([]);
});

test('opts in, then changes the volume and mutes', async ({ page }) => {
  await openAudioSettings(page);
  const viewport = page.locator('#viewport');
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

test('plays one radio loop in the basement, fetched only once the door opens', async ({
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
  expect(radioRequests).toEqual([]);
  await page.keyboard.press('e');
  await expect(prompt).toBeEmpty({ timeout: 10000 });
  // The track is fetched with the basement, before the visitor reaches it.
  await expect.poll(() => radioRequests.length).toBe(1);

  await page.keyboard.down('w');
  await expect(viewport).toHaveAttribute('data-radio', 'playing', {
    timeout: 15000,
  });
  const far = await radioDistance(page);
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  await expect(viewport).toHaveAttribute('data-radio-sources', '1');
  // The listener follows the visitor: walking in brings the set closer.
  const near = await radioDistance(page);
  if (far !== undefined && near !== undefined) expect(near).toBeLessThan(far);

  // Leaving fades the loop out, then stops and disconnects its source.
  await page.keyboard.down('s');
  await expect(viewport).toHaveAttribute('data-radio', 'idle', {
    timeout: 15000,
  });
  await page.keyboard.up('s');
  await expect(viewport).toHaveAttribute('data-radio-sources', '0', {
    timeout: 5000,
  });
  await expect(viewport).toHaveAttribute('data-ambience', 'gallery');
  expect(radioRequests).toHaveLength(1);
});
