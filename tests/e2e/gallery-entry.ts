import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const testGalleryPassword = 'local-gallery-test-fixture';

export async function unlockGallery(page: Page) {
  const entry = page.getByRole('dialog', { name: 'Gallery entry' });
  await entry.getByLabel('Password').fill(testGalleryPassword);
  await entry.getByRole('button', { name: 'Unlock gallery' }).click();
  await expect(entry).toBeHidden();
}
