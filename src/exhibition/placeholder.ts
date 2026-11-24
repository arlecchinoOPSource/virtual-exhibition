import { CanvasTexture, TextureLoader } from 'three';
import type { Texture } from 'three';
import type { Exhibit } from '../types/exhibit';

export function paintExhibit(exhibit: Exhibit): Texture {
  if (exhibit.status === 'ready')
    return new TextureLoader().load(
      `${import.meta.env.BASE_URL}${exhibit.image}`,
    );
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 390;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not draw the placeholder artwork.');
  // Canvas rows run top-down, while the frame uses glTF texture coordinates.
  context.fillStyle = '#e6d2a6';
  context.fillRect(0, 0, 512, 390);
  context.strokeStyle = '#826343';
  context.lineWidth = 2;
  context.strokeRect(24, 24, 464, 342);
  context.textAlign = 'center';
  context.fillStyle = '#2d2319';
  context.font = '42px Georgia';
  context.fillText('Exhibition', 256, 164);
  context.font = '22px Georgia';
  context.fillText(`Display ${exhibit.anchor.slice(-2)}`, 256, 214);
  context.fillText('Reserved for a student submission', 256, 269);
  return new CanvasTexture(canvas);
}
