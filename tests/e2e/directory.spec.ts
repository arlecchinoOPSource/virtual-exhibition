import { expect, test } from '@playwright/test';

const essayTitle = 'Bakit Hindi Puwedeng Maging Filipino Rin si Doraemon';

test('lists every exhibit without WebGL', async ({ page }) => {
  // Refuse WebGL contexts to show the directory never needs them.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith('webgl')) return null;
      return getContext.call(this, type as '2d', ...(args as []));
    } as typeof getContext;
  });
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto('/directory.html');

  const exhibits = page.getByRole('list', { name: 'Exhibits' });
  await expect(exhibits.getByRole('listitem')).toHaveCount(15);
  const first = exhibits.getByRole('article', { name: essayTitle });
  await expect(first).toContainText('Display 01');
  await expect(first.getByRole('img', { name: essayTitle })).toBeVisible();
  await expect(
    first.getByRole('link', { name: 'Open PDF file' }),
  ).toHaveAttribute('href', '/essays/doraemon-filipino.pdf');
  await expect(
    exhibits.getByRole('article', { name: 'Artwork placeholder 2' }),
  ).toContainText('No essay yet.');
  await expect(page.getByRole('status')).toBeHidden();
  expect(errors).toEqual([]);
});

test('opens and closes an essay with the keyboard', async ({ page }) => {
  await page.goto('/directory.html');
  const read = page
    .getByRole('article', { name: essayTitle })
    .getByRole('button', { name: 'Read the essay' });
  const viewer = page.locator('#essay-viewer');
  const pages = viewer.locator('.viewer-pages');

  await read.focus();
  await page.keyboard.press('Enter');
  await expect(viewer).toBeVisible();
  await expect(pages).toBeFocused();
  await expect(pages).toHaveAttribute('data-rendered-zoom', '1', {
    timeout: 15000,
  });
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(read).toBeFocused();
});

test('keeps the keyboard fallback and fills the gallery viewport', async ({
  page,
}) => {
  await page.goto('/');
  const canvas = page.locator('#scene');
  const size = await canvas.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return (box.width * box.height) / (innerWidth * innerHeight);
  });
  expect(size).toBeGreaterThanOrEqual(0.9);
  await page.keyboard.press('Tab');
  const fallback = page.getByRole('link', {
    name: 'Browse exhibits without 3D',
  });
  await expect(fallback).toBeFocused();
  await fallback.press('Enter');
  await expect(page).toHaveURL(/directory\.html$/);
  await expect(
    page.getByRole('heading', { name: 'Exhibition directory' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Return to the 3D gallery' }).click();
  await expect(canvas).toHaveAttribute('data-environment', 'gallery');
});

test('opens the catalogue with E and click and restores the view', async ({
  page,
}) => {
  // Move only the test spawn beside the lectern, keeping real geometry and collision.
  await page.route('**/models/gallery.glb', async (route) => {
    const response = await route.fetch();
    const model = await response.body();
    const jsonLength = model.readUInt32LE(12);
    const document = JSON.parse(
      model.subarray(20, 20 + jsonLength).toString('utf8'),
    ) as {
      nodes: { name?: string; translation?: number[] }[];
    };
    const spawn = document.nodes.find(({ name }) => name === 'Spawn_Gallery');
    if (!spawn) throw new Error('Expected a gallery spawn in the GLB.');
    spawn.translation = [-1.65, 0, 0];
    const json = JSON.stringify(document);
    const padded = Buffer.from(
      json + ' '.repeat((4 - (Buffer.byteLength(json) % 4)) % 4),
    );
    const header = Buffer.from(model.subarray(0, 20));
    header.writeUInt32LE(model.length - jsonLength + padded.length, 8);
    header.writeUInt32LE(padded.length, 12);
    await route.fulfill({
      response,
      body: Buffer.concat([header, padded, model.subarray(20 + jsonLength)]),
    });
  });

  await page.goto('/');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start walk' }).press('Enter');
  await expect(page.locator('#crosshair')).toBeVisible();
  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent('mousemove', { movementY: 143 }));
  });
  const prompt = page.locator('#interaction');
  await expect(prompt).toHaveText('E / Click · Open Exhibition Directory');
  await page.keyboard.press('e');
  const catalogue = page.getByRole('dialog', { name: 'Exhibition Directory' });
  await expect(catalogue.getByRole('listitem')).toHaveCount(15);
  await expect(page.locator('#crosshair')).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement === null))
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(catalogue).toBeHidden();
  const resume = page.getByRole('button', { name: 'Resume walk' });
  await expect(resume).toBeFocused();
  await resume.press('Enter');
  await expect(prompt).toHaveText('E / Click · Open Exhibition Directory');
  await page.mouse.down();
  await page.mouse.up();
  await expect(catalogue).toBeVisible();
  await catalogue.getByRole('button', { name: 'Close' }).click();
  await expect(resume).toBeFocused();
});
