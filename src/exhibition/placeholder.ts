import { DataTexture, TextureLoader } from 'three';
import type { Texture } from 'three';
import type { Exhibit } from '../types/exhibit';

export function paintExhibit(exhibit: Exhibit): Texture {
  if (exhibit.status === 'ready')
    return new TextureLoader().load(
      `${import.meta.env.BASE_URL}${exhibit.image}`,
    );
  // Blank grey until placeholder art is approved.
  const texture = new DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}
