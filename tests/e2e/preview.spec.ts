import { expect, test } from '@playwright/test';

test('draws the preview in WebGL and resizes the canvas', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');
  const canvas = page.getByRole('img', {
    name: 'Eye-level view inside a greybox room',
  });
  await expect(canvas).toHaveAttribute('data-exhibit-count', '12');
  await expect(page.getByRole('status')).toBeHidden();

  const width = await canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement))
      throw new Error('Expected a canvas');
    const gl = element.getContext('webgl2');
    if (!gl || gl.isContextLost())
      throw new Error('Expected a live WebGL 2 context');
    const program = gl.getParameter(gl.CURRENT_PROGRAM);
    if (!program)
      throw new Error('Expected the renderer to have used a shader program');
    return element.width;
  });
  await page.setViewportSize({ width: 450, height: 720 });
  await expect
    .poll(() =>
      canvas.evaluate((element) => (element as HTMLCanvasElement).width),
    )
    .toBeLessThan(width);
  expect(pageErrors).toEqual([]);
});

test('shows an accessible error when the manifest fails', async ({ page }) => {
  await page.route('**/data/exhibits.json', (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText(
    'Could not load the preview.',
  );
});

test('pauses frame rendering while hidden and preserves the view on resume', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const drawElements = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (
      this: WebGL2RenderingContext,
      ...args: Parameters<typeof drawElements>
    ) {
      if (this.canvas instanceof HTMLCanvasElement) {
        const canvas = this.canvas;
        canvas.dataset.drawCount = String(
          Number(canvas.dataset.drawCount ?? 0) + 1,
        );
      }
      drawElements.apply(this, args);
    };
  });
  await page.goto('/');
  const canvas = page.getByRole('img', {
    name: 'Eye-level view inside a greybox room',
  });
  await expect(canvas).toHaveAttribute('data-exhibit-count', '12');
  const readDrawCount = async () =>
    Number(await canvas.getAttribute('data-draw-count'));
  const initialDrawCount = await readDrawCount();
  await expect.poll(readDrawCount).toBeGreaterThan(initialDrawCount);
  const before = await canvas.screenshot();

  // Dispatch the visibility signal while Chromium still delivers test-side RAFs.
  const setHidden = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

  await setHidden(true);
  const pausedDrawCount = await readDrawCount();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  expect(await readDrawCount()).toBe(pausedDrawCount);

  await setHidden(false);
  await expect.poll(readDrawCount).toBeGreaterThan(pausedDrawCount);
  expect(await canvas.screenshot()).toEqual(before);
});
