import { vi } from 'vitest';

// Node has no browser bitmap decoder. Read the embedded PNG header so the
// Three.js loader and texture-budget tests use the exported dimensions.
vi.stubGlobal('self', globalThis);
vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
  const header = new DataView(await blob.slice(0, 24).arrayBuffer());
  if (header.getUint32(0) !== 0x89504e47 || header.getUint32(12) !== 0x49484452)
    throw new Error('Expected a PNG with an IHDR chunk');
  return { width: header.getUint32(16), height: header.getUint32(20) };
});
