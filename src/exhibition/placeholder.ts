import { CanvasTexture, TextureLoader } from 'three';
import type { Texture } from 'three';
import type { Exhibit } from '../types/exhibit';

const WIDTH = 1024;
const HEIGHT = 768;

// Small seeded generator so each slot always gets the same composition.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPlaceholder(slot: number, awaiting: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');

  if (awaiting) {
    context.fillStyle = '#ece8df';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.strokeStyle = '#9a958a';
    context.lineWidth = 6;
    context.setLineDash([24, 16]);
    context.strokeRect(80, 80, WIDTH - 160, HEIGHT - 160);
    context.fillStyle = '#5b574f';
    context.font = '600 44px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('Awaiting approved artwork', WIDTH / 2, HEIGHT / 2 + 16);
  } else {
    const next = random(slot * 9973);
    const hue = (slot * 47) % 360;
    context.fillStyle = `hsl(${hue} 25% 84%)`;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    for (let shape = 0; shape < 7; shape++) {
      context.globalAlpha = 0.85;
      context.fillStyle = `hsl(${(hue + next() * 140) % 360} ${45 + next() * 25}% ${32 + next() * 30}%)`;
      const x = next() * WIDTH;
      const y = next() * HEIGHT;
      const size = 80 + next() * 260;
      if (next() < 0.5) {
        context.beginPath();
        context.arc(x, y, size / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(x - size / 2, y - size / 3, size, (size * 2) / 3);
      }
    }
    context.globalAlpha = 1;
  }

  // The slot number sits top-left, which also shows the art is not mirrored.
  context.fillStyle = '#1d1f22';
  context.font = '700 72px system-ui, sans-serif';
  context.textAlign = 'left';
  context.fillText(String(slot).padStart(2, '0'), 48, 112);
  return canvas;
}

export function paintExhibit(exhibit: Exhibit, slot: number): Texture {
  if (exhibit.status === 'ready')
    return new TextureLoader().load(
      `${import.meta.env.BASE_URL}${exhibit.image}`,
    );
  return new CanvasTexture(
    drawPlaceholder(slot, exhibit.status === 'awaiting-assets'),
  );
}
