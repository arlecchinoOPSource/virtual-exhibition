import { unlockGallery } from './gallery-entry';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { spawnAtBasementDoor } from './basement';
import { moveSpawn } from './spawn';

// The walkable milestone (#89): every one of the 18 frames can be reached,
// shows its manifest label, and opens its details from the keyboard alone.
// Upstairs, the test spawn is moved 2 m in front of each frame, facing it;
// the basement is walked from its door, since it loads only when opened.

interface Frame {
  slot: string;
  section: string;
  at: [number, number];
  gaze: 'N' | 'S' | 'E' | 'W';
}
const plan = JSON.parse(
  readFileSync('assets-source/layout/redesign.json', 'utf8'),
) as { frames: Frame[] };
const manifest = JSON.parse(
  readFileSync('public/data/exhibits.json', 'utf8'),
) as { anchor: string; title: string; pdf: string | null }[];
const titleOf = (slot: string) =>
  manifest.find((entry) => entry.anchor === slot)!.title;

// Blender gaze to a step toward the frame, and the spawn rotation (a Three.js
// quaternion about +Y) that looks that way; the camera looks down -Z.
const s = Math.SQRT1_2;
const facing = {
  N: { step: [0, 1], rotation: [0, 0, 0, 1] },
  S: { step: [0, -1], rotation: [0, 1, 0, 0] },
  E: { step: [1, 0], rotation: [0, -s, 0, s] },
  W: { step: [-1, 0], rotation: [0, s, 0, s] },
} as const;

async function startWalk(page: Page) {
  await page.goto('/');
  await unlockGallery(page);
  await page.bringToFront();
  // Keyboard only: Enter starts the walk, E opens, Escape closes.
  await page.getByRole('button', { name: 'Start walk' }).press('Enter');
  await expect(page.locator('#crosshair')).toBeVisible();
}

async function checkDetails(page: Page, slot: string) {
  const title = titleOf(slot);
  const label = page.locator('#exhibit-label');
  await expect(label.getByRole('heading'), slot).toHaveText(title);
  await expect(page.locator('#interaction')).toHaveText(
    'E / Click · View details',
  );
  await page.keyboard.press('e');
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog, slot).toBeVisible();
  const essay = dialog.getByRole('button', { name: 'Read the essay' });
  if (manifest.find((entry) => entry.anchor === slot)!.pdf)
    await expect(essay, slot).toBeVisible();
  else await expect(essay, slot).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  const resume = page.getByRole('button', { name: 'Resume walk' });
  await expect(resume).toBeFocused();
  await resume.press('Enter');
  await expect(label.getByRole('heading'), slot).toHaveText(title);
}

for (const frame of plan.frames.filter((f) => f.section !== 'basement')) {
  test(`${frame.slot} in the ${frame.section} is reachable and opens its details`, async ({
    page,
  }) => {
    const { step, rotation } = facing[frame.gaze];
    const [x, y] = frame.at;
    await moveSpawn(page, [x - step[0] * 2, 0, -(y - step[1] * 2)], [
      ...rotation,
    ] as [number, number, number, number]);
    await startWalk(page);
    await checkDetails(page, frame.slot);
  });
}

test('the three basement frames are reachable once the door opens', async ({
  page,
}) => {
  test.setTimeout(120000);
  const turn = (radians: number) =>
    page.evaluate(
      (dx) =>
        document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx })),
      radians * 500,
    );
  const label = page.locator('#exhibit-label').getByRole('heading');
  await spawnAtBasementDoor(page);
  await startWalk(page);
  await expect(page.locator('#interaction')).toHaveText(
    'E / Click · Open the door',
  );
  await page.keyboard.press('e');
  await expect(page.locator('#interaction')).toBeEmpty({ timeout: 10000 });
  // Down the stairs and across the room until the throne stops the visitor;
  // slow software rendering shortens each step, so allow plenty of time.
  await page.keyboard.down('w');
  await page.waitForTimeout(16000);
  await page.keyboard.up('w');

  // Exhibit_17: a quarter turn left (north) and walk up to it.
  await turn(-Math.PI / 2);
  await page.keyboard.down('w');
  await expect(label).toHaveText(titleOf('Exhibit_17'), { timeout: 15000 });
  await page.keyboard.up('w');
  await checkDetails(page, 'Exhibit_17');

  // Exhibit_16: up to the north wall (the label shows from 3 m, so stopping
  // where it appears leaves the visitor on that edge), then step left (west)
  // along the wall.
  await page.keyboard.down('w');
  await page.waitForTimeout(3000);
  await page.keyboard.up('w');
  await page.keyboard.down('a');
  await expect(label).toHaveText(titleOf('Exhibit_16'), { timeout: 15000 });
  await page.keyboard.up('a');
  await checkDetails(page, 'Exhibit_16');

  // Exhibit_18: step back east until Exhibit_17 is in view again (just
  // west of the throne), then half a turn to face south across the room.
  await page.keyboard.down('d');
  await expect(label).toHaveText(titleOf('Exhibit_17'), { timeout: 15000 });
  await page.keyboard.up('d');
  await turn(Math.PI);
  await page.keyboard.down('w');
  await expect(label).toHaveText(titleOf('Exhibit_18'), { timeout: 15000 });
  await page.keyboard.up('w');
  await checkDetails(page, 'Exhibit_18');
});
