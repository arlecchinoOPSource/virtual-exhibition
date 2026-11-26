import { expect, test } from '@playwright/test';
import { moveSpawn } from './spawn';

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
  // Stand at the catalogue stand's reading side, north of it on the arrival
  // axis: Blender (-9.2, 0.35).
  await moveSpawn(page, [-9.2, 0, -0.35]);

  await page.goto('/');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start walk' }).press('Enter');
  await expect(page.locator('#crosshair')).toBeVisible();
  await page.evaluate(() => {
    // A quarter turn right faces south across the stand, then look down.
    document.dispatchEvent(
      new MouseEvent('mousemove', { movementX: (Math.PI / 2) * 500 }),
    );
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
