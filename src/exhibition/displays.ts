import { Mesh, MeshStandardMaterial, SRGBColorSpace } from 'three';
import type { Object3D, Texture } from 'three';
import type { Exhibit } from '../types/exhibit';

export type Painter = (exhibit: Exhibit, slot: number) => Texture;

// Puts each manifest entry's artwork on the frame canvas at its named anchor.
export function hangExhibits(
  anchors: readonly Object3D[],
  exhibits: readonly Exhibit[],
  paint: Painter,
) {
  const byAnchor = new Map<Object3D, Exhibit>();
  const textures: Texture[] = [];
  // Match every entry to its anchor and canvas before painting anything, so a
  // bad pairing throws without leaving textures behind.
  const canvases = exhibits.map((exhibit) => {
    const matches = anchors.filter((anchor) => anchor.name === exhibit.anchor);
    const [anchor] = matches;
    if (!anchor || matches.length !== 1 || byAnchor.has(anchor))
      throw new Error(`${exhibit.anchor} must resolve to one free anchor.`);
    const canvas = anchor.getObjectByName('Frame_Canvas');
    if (!(canvas instanceof Mesh))
      throw new Error(`${anchor.name} has no Frame_Canvas.`);
    byAnchor.set(anchor, exhibit);
    return canvas;
  });
  if (byAnchor.size !== anchors.length)
    throw new Error('Every anchor needs exactly one exhibit.');

  exhibits.forEach((exhibit, index) => {
    const canvas = canvases[index]!;
    const texture = paint(exhibit, index + 1);
    // glTF UVs put v = 0 on the top edge, so textures must not be flipped.
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    textures.push(texture);
    canvas.material = new MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
    });
  });

  return {
    exhibitAt(object: Object3D | undefined) {
      for (let node = object; node; node = node.parent ?? undefined) {
        const exhibit = byAnchor.get(node);
        if (exhibit) return exhibit;
      }
      return undefined;
    },
    // Materials are disposed with the gallery; their maps are not.
    dispose() {
      for (const texture of textures) texture.dispose();
    },
  };
}
