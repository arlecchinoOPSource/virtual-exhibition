import type { Page } from '@playwright/test';

// Puts the test visitor on the basement door axis by moving the gallery
// spawn in the served GLB. Separate unit tests walk the gallery itself.
export async function spawnAtBasementDoor(page: Page) {
  await page.route('**/models/gallery.glb', async (route) => {
    const response = await route.fetch();
    const model = await response.body();
    const jsonLength = model.readUInt32LE(12);
    const document = JSON.parse(
      model.subarray(20, 20 + jsonLength).toString('utf8'),
    ) as {
      nodes: { name?: string; translation?: number[] }[];
    };
    const spawn = document.nodes.find(({ name }) => name === 'Spawn_Gallery');
    if (!spawn) throw new Error('Expected a gallery spawn in the GLB.');
    spawn.translation = [9.74, 0, 0];
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
