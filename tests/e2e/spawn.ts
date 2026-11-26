import type { Page } from '@playwright/test';

// Moves only the test visitor's spawn, keeping the real geometry and
// collision: rewrites Spawn_Gallery's translation (Three.js metres) and,
// optionally, its rotation quaternion [x, y, z, w] in the served gallery.glb.
// The spawn faces east unless turned. Unit tests walk the gallery itself
// (route.test.ts).
export async function moveSpawn(
  page: Page,
  translation: [number, number, number],
  rotation?: [number, number, number, number],
) {
  await page.route('**/models/gallery.glb', async (route) => {
    const response = await route.fetch();
    const model = await response.body();
    const jsonLength = model.readUInt32LE(12);
    const document = JSON.parse(
      model.subarray(20, 20 + jsonLength).toString('utf8'),
    ) as {
      nodes: { name?: string; translation?: number[]; rotation?: number[] }[];
    };
    const spawn = document.nodes.find(({ name }) => name === 'Spawn_Gallery');
    if (!spawn) throw new Error('Expected a gallery spawn in the GLB.');
    spawn.translation = translation;
    if (rotation) spawn.rotation = rotation;
    const json = JSON.stringify(document);
    const padded = Buffer.from(
      json + ' '.repeat((4 - (Buffer.byteLength(json) % 4)) % 4),
    );
    const header = Buffer.from(model.subarray(0, 20));
    header.writeUInt32LE(model.length - jsonLength + padded.length, 8);
    header.writeUInt32LE(padded.length, 12);
    await route.fulfill({
      response,
      body: Buffer.concat([header, padded, model.subarray(20 + jsonLength)]),
    });
  });
}
