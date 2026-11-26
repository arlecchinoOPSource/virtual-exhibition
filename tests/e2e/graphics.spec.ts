import { unlockGallery } from './gallery-entry';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { moveSpawn } from './spawn';

async function openSettings(page: Page) {
  // Start at the arrival end of the band, with spotlit frames in view: the
  // real spawn is inside the closed elevator car.
  await moveSpawn(page, [-12.5, 0, 0]);
  await page.goto('/');
  await unlockGallery(page);
  const canvas = page.locator('#scene');
  await expect(canvas).toHaveAttribute('data-environment', 'gallery');
  await page.locator('#settings summary').click();
  return canvas;
}

const canvasWidth = (page: Page) =>
  page.locator('#scene').evaluate((c) => (c as HTMLCanvasElement).width);

// Frames per second over two seconds, measured inside the page.
const measureFps = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        let start = 0;
        const tick = (now: number) => {
          if (!start) start = now;
          frames++;
          if (now - start < 2000) requestAnimationFrame(tick);
          else resolve((frames * 1000) / (now - start));
        };
        requestAnimationFrame(tick);
      }),
  );

test('applies the resolution immediately and keeps it', async ({ page }) => {
  await openSettings(page);
  const full = await canvasWidth(page);
  await page.getByLabel('Resolution').fill('0.5');
  await expect(page.locator('#resolution-value')).toHaveText('50%');
  await expect.poll(() => canvasWidth(page)).toBe(Math.floor(full / 2));
  await page.reload();
  await expect.poll(() => canvasWidth(page)).toBe(Math.floor(full / 2));
});

test('turns the spotlights off immediately', async ({ page }) => {
  const canvas = await openSettings(page);
  const lit = await canvas.screenshot();
  await page.getByLabel('Display spotlights').uncheck();
  await expect
    .poll(async () => (await canvas.screenshot()).equals(lit))
    .toBe(false);
});

test('lowers the rendering cost with the low-cost settings', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Chromium renders with SwiftShader here, so frame time tracks GPU work.',
  );
  await openSettings(page);
  await page.waitForTimeout(1000);
  const high = await measureFps(page);
  await page.getByLabel('Resolution').fill('0.5');
  await page.getByLabel('Display spotlights').uncheck();
  await page.waitForTimeout(1000);
  const low = await measureFps(page);
  test.info().annotations.push({
    type: 'fps',
    description: `high ${high.toFixed(1)} → low ${low.toFixed(1)}`,
  });
  console.log(`FPS high ${high.toFixed(1)} low ${low.toFixed(1)}`);
  expect(low).toBeGreaterThan(high * 1.25);
});
