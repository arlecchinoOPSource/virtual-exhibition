import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';
import { createGreybox } from '../../src/environments/greybox';
import { stepBody } from '../../src/player/collision';
import { createTargetPicker } from '../../src/player/interaction';

describe('greybox traversal', () => {
  it('stops at the display and walls while allowing motion along their faces', () => {
    const world = createGreybox();
    const body = { feet: new Vector3(0, 0, 4.2), grounded: true, fallSpeed: 0 };
    const walk = (dx: number, dz: number) => {
      for (let count = 0; count < 400; count++) {
        stepBody(body, dx, dz, 1 / 120, world.solids);
      }
    };

    walk(0, -0.025);
    expect(body.feet.z).toBeCloseTo(-2.06, 1);
    walk(-0.025, -0.025);
    expect(body.feet.x).toBeCloseTo(-3.6, 1);
    expect(body.feet.z).toBeCloseTo(-5.6, 1);
    expect(body.feet.y).toBeCloseTo(0);
    world.dispose();
  });

  it.each([30, 60, 144])(
    'lands and traverses the stairs in both directions at %i fps',
    (fps) => {
      const world = createGreybox();
      const body = {
        feet: new Vector3(2.15, 1.2, 0),
        grounded: false,
        fallSpeed: 0,
      };
      for (let i = 0; i < fps; i++) stepBody(body, 0, 0, 1 / fps, world.solids);
      expect(body.feet.y).toBeCloseTo(0);
      expect(body.grounded).toBe(true);
      for (let i = 0; i < fps; i++)
        stepBody(body, 0, -3.2 / fps, 1 / fps, world.solids);
      expect(body.feet.y).toBeCloseTo(0.9);
      expect(body.grounded).toBe(true);
      for (let i = 0; i < fps; i++)
        stepBody(body, 0, 3.2 / fps, 1 / fps, world.solids);
      expect(body.feet.y).toBeCloseTo(0);
      expect(body.grounded).toBe(true);
      world.dispose();
    },
  );
});

describe('center-ray interaction', () => {
  it('rejects distant, occluded, and off-center targets', () => {
    const camera = new PerspectiveCamera(60, 1, 0.05, 40);
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();
    const target = new Mesh(geometry, material);
    const blocker = new Mesh(geometry, material);
    target.position.z = -4;
    blocker.position.set(2, 0, -1.5);
    blocker.updateMatrixWorld();
    target.updateMatrixWorld();
    const hasTarget = createTargetPicker(camera, [target, blocker], target, 3);
    expect(hasTarget()).toBe(false);
    camera.position.z = -1;
    expect(hasTarget()).toBe(true);
    camera.rotation.y = Math.PI / 4;
    expect(hasTarget()).toBe(false);
    camera.rotation.y = 0;
    blocker.position.set(0, 0, -2);
    blocker.updateMatrixWorld();
    expect(hasTarget()).toBe(false);
    geometry.dispose();
    material.dispose();
  });
});
