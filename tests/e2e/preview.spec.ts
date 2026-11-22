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

  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) return false;
        const gl = element.getContext('webgl2');
        return Boolean(
          gl && !gl.isContextLost() && gl.getParameter(gl.CURRENT_PROGRAM),
        );
      }),
    )
    .toBe(true);

  const width = await canvas.evaluate(
    (element) => (element as HTMLCanvasElement).width,
  );
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

test('captures the pointer, walks to the switch, interacts, and pauses', async ({
  page,
}) => {
  await page.goto('/');
  const start = page.getByRole('button', { name: 'Start walk' });
  const resume = page.getByRole('button', { name: 'Resume walk' });
  const prompt = page.locator('#interaction');
  const crosshair = page.locator('#crosshair');
  const canvas = page.getByRole('img', {
    name: 'Eye-level view inside a greybox room',
  });
  const pointerIsCaptured = () =>
    page.evaluate(() => document.pointerLockElement?.id === 'scene');

  // Pointer lock needs a focused window; headed Chromium on macOS can open unfocused.
  await page.bringToFront();
  await start.click();
  await expect.poll(pointerIsCaptured).toBe(true);
  await expect(crosshair).toBeVisible();
  await page.keyboard.press('e');
  await expect(prompt).toBeEmpty();

  await page.keyboard.down('w');
  await expect(prompt).toContainText('Turn display light on', {
    timeout: 8000,
  });
  await page.keyboard.up('w');

  // Drive a known mouse delta while the browser's native pointer lock is active.
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 300 })),
  );
  await expect(prompt).toBeEmpty();
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: -300 })),
  );
  await expect(prompt).toContainText('Turn display light on');

  await page.keyboard.press('e');
  await expect(prompt).toContainText('Turn display light off');
  await page.mouse.down();
  await page.mouse.up();
  await expect(prompt).toContainText('Turn display light on');

  await page.keyboard.down('w');
  await page.keyboard.press('Escape');
  await expect.poll(pointerIsCaptured).toBe(false);
  await expect(resume).toBeVisible();
  await expect(crosshair).toBeHidden();
  await expect(prompt).toBeEmpty();
  await page.keyboard.press('e');
  await expect.poll(pointerIsCaptured).toBe(false);

  await resume.click();
  await expect.poll(pointerIsCaptured).toBe(true);
  const resumedView = await canvas.screenshot();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }),
  );
  expect(await canvas.screenshot()).toEqual(resumedView);
  await page.keyboard.up('w');
  await expect(prompt).toContainText('Turn display light on');
});
