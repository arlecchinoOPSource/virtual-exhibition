import { expect, test } from '@playwright/test';
import { unlockGallery } from './gallery-entry';

test('requires the password before the elevator can open', async ({ page }) => {
  await page.goto('/');
  const entry = page.getByRole('dialog', { name: 'Gallery entry' });
  const password = entry.getByLabel('Password');
  const start = page.locator('#start-walk');
  const crosshair = page.locator('#crosshair');

  await expect(password).toBeFocused();
  await expect(start).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(entry).toBeVisible();
  await password.fill('incorrect');
  await password.press('Enter');
  await expect(entry.getByRole('alert')).toHaveText(
    'Incorrect password. Try again.',
  );
  await expect(start).toBeDisabled();
  await expect(crosshair).toBeHidden();

  await unlockGallery(page);
  await expect(start).toBeFocused();
  await start.press('Enter');
  await expect(crosshair).toBeVisible();

  await page.reload();
  await expect(entry).toBeVisible();
  await expect(start).toBeDisabled();
});
