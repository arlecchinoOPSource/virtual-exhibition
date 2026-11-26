import type { Page } from '@playwright/test';
import { moveSpawn } from './spawn';

// Puts the test visitor on the basement door's axis in the rear landing,
// facing east into the stairwell, by moving the gallery
// spawn in the served GLB. Separate unit tests walk the gallery itself.
export async function spawnAtBasementDoor(page: Page) {
  await moveSpawn(page, [9.74, 0, 0]);
}
