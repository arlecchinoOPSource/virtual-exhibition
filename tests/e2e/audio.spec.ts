import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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
  await openAudioSettings(page);
  const viewport = page.locator('#viewport');
  await page.getByLabel('Play environmental sound').check();
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start walk' }).click();
  await expect(page.locator('#crosshair')).toBeVisible();
  const prompt = page.locator('#interaction');

  // Strafe onto the south walkway, walk to the right end wall, and strafe
  // back by the same amount so the visitor stands centred on the doorway.
  const strafe = async (key: string) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(800);
    await page.keyboard.up(key);
  };
  await strafe('d');
  await page.keyboard.down('w');
  await page.waitForTimeout(6000);
  await page.keyboard.up('w');
  await strafe('a');
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
