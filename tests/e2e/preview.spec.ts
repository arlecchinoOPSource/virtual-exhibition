import { expect, test } from '@playwright/test';

test('draws the preview in WebGL and resizes the canvas', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto('/');
  const canvas = page.getByRole('img', {
    name: 'Illuminated geometric shapes on a floor',
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
