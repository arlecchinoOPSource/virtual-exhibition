import { expect, test } from '@playwright/test';
import { moveSpawn } from './spawn';
import type { Page } from '@playwright/test';

test('draws the preview in WebGL and resizes the canvas', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');
  const canvas = page.getByRole('img', {
    name: 'Eye-level view inside the exhibition',
  });
  await expect(canvas).toHaveAttribute('data-environment', 'gallery');
  await expect(canvas).toHaveAttribute('data-exhibit-count', '15');
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

for (const model of ['gallery', 'frame']) {
  test(`shows an accessible error when the ${model} model fails`, async ({
    page,
  }) => {
    await page.route(`**/models/${model}.glb`, (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.goto('/');
    await expect(page.getByRole('status')).toContainText(
      'Could not load the preview.',
    );
  });
}

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
    name: 'Eye-level view inside the exhibition',
  });
  await expect(canvas).toHaveAttribute('data-exhibit-count', '15');
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
  await page.goto('/?env=greybox');
  const start = page.getByRole('button', { name: 'Start walk' });
  const resume = page.getByRole('button', { name: 'Resume walk' });
  const prompt = page.locator('#interaction');
  const crosshair = page.locator('#crosshair');
  const canvas = page.getByRole('img', {
    name: 'Eye-level view inside the exhibition',
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

const essayTitle = 'Bakit Hindi Puwedeng Maging Filipino Rin si Doraemon';

// Starts the walk 3.5 m in front of Exhibit_01 on the studio's west wall,
// turns to face it, and walks until its label shows. Walking waits on the
// label, not a timer, because slow frames shorten each step.
async function walkToExhibitOne(page: Page) {
  // Blender (-10.5, 4.0): in the studio, level with the frame.
  await moveSpawn(page, [-10.5, 0, -4]);
  await page.goto('/');
  const label = page.locator('#exhibit-label');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start walk' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.pointerLockElement?.id === 'scene'),
    )
    .toBe(true);
  // The crosshair appears once the game handles capture and accepts mouse look.
  await expect(page.locator('#crosshair')).toBeVisible();
  await expect(label).toBeHidden();
  // One radian is 500 px of mouse movement at the current look speed; the
  // spawn faces east, so half a turn faces the west wall.
  await page.evaluate(
    (dx) =>
      document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })),
    Math.PI * 500,
  );
  await page.keyboard.down('w');
  await expect(label).toBeVisible({ timeout: 15000 });
  await page.keyboard.up('w');
  return label;
}

test('labels a gallery display with its manifest title and description', async ({
  page,
}) => {
  const label = await walkToExhibitOne(page);
  await expect(label.getByRole('heading')).toHaveText(essayTitle);
  await expect(label).toContainText('An essay in Filipino');
  await expect(page.locator('#interaction')).toHaveText(
    'E / Click · View details',
  );

  await page.keyboard.press('Escape');
  await expect(label).toBeHidden();
});

test('opens exhibit details with the essay and resumes in place', async ({
  page,
}) => {
  const label = await walkToExhibitOne(page);
  const dialog = page.getByRole('dialog', { name: essayTitle });
  const resume = page.getByRole('button', { name: 'Resume walk' });

  await page.keyboard.press('e');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('An essay in Filipino');
  await expect(
    dialog.getByRole('button', { name: 'Read the essay' }),
  ).toBeVisible();
  await expect
    .poll(() =>
      dialog
        .getByRole('img', { name: essayTitle })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(
    true,
  );
  await expect(page.locator('#crosshair')).toBeHidden();

  // Movement keys do nothing while the details are open.
  await page.keyboard.down('s');
  await page.waitForTimeout(500);
  await page.keyboard.up('s');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(resume).toBeFocused();

  await resume.click();
  await expect(page.locator('#crosshair')).toBeVisible();
  await expect(label.getByRole('heading')).toHaveText(essayTitle);
});

test('reads the essay in the lazy-loaded viewer with keyboard scroll and zoom', async ({
  page,
}) => {
  const pdfRequests: string[] = [];
  page.on('request', (request) => {
    if (/pdfjs-dist|pdf\.worker/.test(request.url()))
      pdfRequests.push(request.url());
  });
  const label = await walkToExhibitOne(page);
  const details = page.locator('#exhibit-details');
  const viewer = page.locator('#essay-viewer');
  const pages = viewer.locator('.viewer-pages');
  const readEssay = details.getByRole('button', { name: 'Read the essay' });

  await page.keyboard.press('e');
  await expect(details).toBeVisible();
  // PDF.js and its worker stay unloaded until a visitor opens an essay.
  expect(pdfRequests).toEqual([]);

  await readEssay.click();
  await expect(viewer).toBeVisible();
  await expect(pages).toBeFocused();
  await expect(pages).toHaveAttribute('data-rendered-zoom', '1', {
    timeout: 15000,
  });
  expect(pdfRequests.length).toBeGreaterThan(0);
  await expect(viewer.getByRole('img', { name: /^Page \d of 5$/ })).toHaveCount(
    5,
  );
  await expect(
    viewer.getByRole('link', { name: 'Open PDF file' }),
  ).toHaveAttribute('href', '/essays/doraemon-filipino.pdf');

  await page.keyboard.press('PageDown');
  await expect
    .poll(() => pages.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  const firstPage = viewer.getByRole('img', { name: 'Page 1 of 5' });
  const width = await firstPage.evaluate(
    (canvas) => canvas.getBoundingClientRect().width,
  );
  await page.keyboard.press('+');
  await expect(viewer.locator('output')).toHaveText('125%');
  await expect(pages).toHaveAttribute('data-rendered-zoom', '1.25');
  expect(
    await firstPage.evaluate((canvas) => canvas.getBoundingClientRect().width),
  ).toBeGreaterThan(width);
  await page.keyboard.press('-');
  await expect(pages).toHaveAttribute('data-rendered-zoom', '1');

  // Escape closes the viewer, then the details, restoring focus each time.
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(readEssay).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();
  const resume = page.getByRole('button', { name: 'Resume walk' });
  await expect(resume).toBeFocused();
  await resume.click();
  await expect(label.getByRole('heading')).toHaveText(essayTitle);
});

test('offers the PDF file when the essay fails to load', async ({ page }) => {
  await page.route('**/essays/doraemon-filipino.pdf', (route) =>
    route.fulfill({ status: 404 }),
  );
  await walkToExhibitOne(page);
  await page.keyboard.press('e');
  await page
    .locator('#exhibit-details')
    .getByRole('button', { name: 'Read the essay' })
    .click();
  const viewer = page.locator('#essay-viewer');
  await expect(viewer.locator('.viewer-status')).toHaveText(
    'The essay could not be loaded. Use Open PDF file instead.',
    { timeout: 15000 },
  );
  await expect(
    viewer.getByRole('link', { name: 'Open PDF file' }),
  ).toBeVisible();
});

// Put the test visitor on the door axis. Separate unit tests walk the gallery.
async function walkToBasementDoor(page: Page) {
  await moveSpawn(page, [9.74, 0, 0]);
  await page.goto('/');
  await page.bringToFront();
  await page.getByRole('button', { name: 'Start walk' }).click();
  await expect(page.locator('#crosshair')).toBeVisible();
  const prompt = page.locator('#interaction');
  await expect(prompt).toHaveText('E / Click · Open the door');
  return prompt;
}

test('opens the basement door with E and closes it again', async ({ page }) => {
  const basementRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('basement.glb'))
      basementRequests.push(request.url());
  });
  const prompt = await walkToBasementDoor(page);
  await page.keyboard.press('e');
  // The open door swings out of view; look left along the stairwell to it.
  await expect(prompt).toBeEmpty({ timeout: 10000 });
  expect(basementRequests).toHaveLength(1);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: -300 })),
  );
  await expect(prompt).toHaveText('E / Click · Close the door');
  await page.keyboard.press('e');
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mousemove', { movementX: 300 })),
  );
  await expect(prompt).toHaveText('E / Click · Open the door');
});

test('makes no basement requests until the visitor opens the door', async ({
  page,
}) => {
  const basementRequests: string[] = [];
  page.on('request', (request) => {
    if (/basement/.test(request.url())) basementRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start walk' }).click();
  await page.keyboard.down('w');
  await page.waitForTimeout(1500);
  await page.keyboard.up('w');
  await page.waitForLoadState('networkidle');
  expect(basementRequests).toEqual([]);
});

test('keeps the gallery usable when the basement fails, then retries', async ({
  page,
}) => {
  await page.route('**/models/basement.glb', (route) =>
    route.fulfill({ status: 503 }),
  );
  const prompt = await walkToBasementDoor(page);
  await page.keyboard.press('e');
  await expect(prompt).toHaveText(
    'The basement could not be loaded · E / Click to try again',
  );
  // The door stayed shut and the walk continues.
  await expect(page.locator('#crosshair')).toBeVisible();
  await page.keyboard.down('s');
  await page.waitForTimeout(300);
  await page.keyboard.up('s');
  await page.keyboard.down('w');
  await page.waitForTimeout(600);
  await page.keyboard.up('w');
  await expect(prompt).toHaveText(
    'The basement could not be loaded · E / Click to try again',
  );

  await page.unroute('**/models/basement.glb');
  await page.keyboard.press('e');
  // A successful retry swings the door out of the crosshair.
  await expect(prompt).toBeEmpty({ timeout: 10000 });
});
