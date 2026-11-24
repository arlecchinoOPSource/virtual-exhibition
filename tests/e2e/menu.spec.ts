import { expect, test } from '@playwright/test';

test('explains the controls on the opening screen', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('group', { name: 'Explore the exhibition' });
  await expect(menu).toBeVisible();
  const controls = menu.getByRole('definition');
  await expect(controls).toHaveText([
    'Move',
    'Look around',
    'View a display or open the basement door',
    'Pause and show this menu',
  ]);
  await expect(menu.getByRole('button', { name: 'Start walk' })).toBeVisible();
  await expect(
    menu.getByRole('link', { name: 'Exhibition directory' }),
  ).toHaveCount(0);
});

test('enters, pauses, and resumes with the keyboard without trapping focus', async ({
  page,
}) => {
  await page.goto('/');
  await page.bringToFront();
  const start = page.getByRole('button', { name: 'Start walk' });
  await expect(start).toBeVisible();

  // The header link comes first, then the menu's Start walk button.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(start).toBeFocused();
  // Keyboard activation may not grant pointer capture (Firefox refuses it), so
  // the walk falls back to arrow-key looking instead of stalling.
  await page.keyboard.press('Enter');
  const crosshair = page.locator('#crosshair');
  await expect(crosshair).toBeVisible();
  const view = page.locator('#scene');
  const before = await view.screenshot();
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowLeft');
  expect(await view.screenshot()).not.toEqual(before);

  await page.keyboard.press('Escape');
  const paused = page.getByRole('group', { name: 'Paused' });
  await expect(paused).toBeVisible();
  const resume = paused.getByRole('button', { name: 'Resume walk' });
  await expect(resume).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(paused.getByText('Settings')).toBeFocused();
  await expect(
    paused.getByRole('link', { name: 'Exhibition directory' }),
  ).toHaveCount(0);
  await page.keyboard.press('Shift+Tab');
  await expect(resume).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(crosshair).toBeVisible();
  await expect(paused).toBeHidden();
});

test('keeps the look sensitivity setting between visits', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('group', { name: 'Explore the exhibition' });
  await menu.getByText('Settings').click();
  const sensitivity = menu.getByLabel('Look sensitivity');
  await sensitivity.fill('1.5');
  await page.reload();
  await page
    .getByRole('group', { name: 'Explore the exhibition' })
    .getByText('Settings')
    .click();
  await expect(page.getByLabel('Look sensitivity')).toHaveValue('1.5');
});
