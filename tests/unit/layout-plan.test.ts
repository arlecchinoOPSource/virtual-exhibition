import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Checks the proposed redesign plan (issue #86) as data: every frame hangs on
// a wall with a clear viewing zone, and the walking routes reach every section
// without passing through walls or furniture envelopes.

type Rect = [number, number, number, number]; // [x0, x1, y0, y1]
type Gaze = 'N' | 'S' | 'E' | 'W';
interface Named {
  id: string;
  rect: Rect;
}
interface Frame {
  slot: string;
  section: string;
  at: [number, number];
  gaze: Gaze;
  wall: string;
}
interface Plan {
  targets: {
    main_route_width: number;
    secondary_route_width: number;
    stair_route_width: number;
    frame_width: number;
    viewing_depth: number;
    viewing_margin: number;
  };
  spawn: { at: [number, number] };
  lectern: { rect: Rect; approach: Rect };
  basement_door: { landing_clear: Rect };
  sections: (Named & { frames: boolean })[];
  walls: Named[];
  furniture: Named[];
  decor: { id: string; wall: string; span: [number, number] }[];
  frames: Frame[];
  routes: (Named & { kind: 'main' | 'secondary' | 'stair' })[];
}

const plan = JSON.parse(
  readFileSync('assets-source/layout/redesign.json', 'utf8'),
) as Plan;
const T = plan.targets;
const EPS = 1e-6;

// Interiors overlap; a shared edge does not count.
const overlaps = (a: Rect, b: Rect) =>
  a[0] < b[1] - EPS &&
  b[0] < a[1] - EPS &&
  a[2] < b[3] - EPS &&
  b[2] < a[3] - EPS;
// Overlap or share an edge: a visitor can step from one to the other.
const touches = (a: Rect, b: Rect) =>
  a[0] <= b[1] + EPS &&
  b[0] <= a[1] + EPS &&
  a[2] <= b[3] + EPS &&
  b[2] <= a[3] + EPS;
const inside = (a: Rect, b: Rect, tol = 0.03) =>
  a[0] >= b[0] - tol &&
  a[1] <= b[1] + tol &&
  a[2] >= b[2] - tol &&
  a[3] <= b[3] + tol;

const solids = [...plan.walls, ...plan.furniture];
function surface(id: string) {
  const found = solids.find((entry) => entry.id === id);
  if (!found) throw new Error(`No wall or surface named ${id}.`);
  return found.rect;
}

// The floor a visitor stands on to look at a frame.
function viewingZone({ at: [x, y], gaze }: Frame): Rect {
  const half = T.frame_width / 2 + T.viewing_margin;
  const depth = T.viewing_depth;
  if (gaze === 'N') return [x - half, x + half, y - depth, y];
  if (gaze === 'S') return [x - half, x + half, y, y + depth];
  if (gaze === 'E') return [x - depth, x, y - half, y + half];
  return [x, x + depth, y - half, y + half];
}

// The frame's extent along its wall.
function span({ at: [x, y], gaze }: Frame): [number, number] {
  const centre = gaze === 'N' || gaze === 'S' ? x : y;
  return [centre - T.frame_width / 2, centre + T.frame_width / 2];
}

describe('redesign layout plan', () => {
  it('reserves 18 unique slots, three in each of the six frame sections', () => {
    expect(plan.frames.map((frame) => frame.slot)).toEqual(
      Array.from(
        { length: 18 },
        (_, i) => `Exhibit_${String(i + 1).padStart(2, '0')}`,
      ),
    );
    expect(plan.sections.filter((s) => s.frames).map((s) => s.id)).toEqual([
      'studio',
      'street',
      'reading',
      'living',
      'theater',
      'basement',
    ]);
    for (const section of plan.sections) {
      const count = plan.frames.filter((f) => f.section === section.id).length;
      expect(count, section.id).toBe(section.frames ? 3 : 0);
    }
  });

  it('hangs every frame flush on its wall, within the wall and clear of other art', () => {
    for (const frame of plan.frames) {
      const [x0, x1, y0, y1] = surface(frame.wall);
      const [x, y] = frame.at;
      const [actual, expected] = {
        N: [y, y0 - 0.02],
        S: [y, y1 + 0.02],
        E: [x, x0 - 0.02],
        W: [x, x1 + 0.02],
      }[frame.gaze];
      expect(actual, frame.slot).toBeCloseTo(expected!, 5);
      const [lo, hi] =
        frame.gaze === 'N' || frame.gaze === 'S' ? [x0, x1] : [y0, y1];
      const [a, b] = span(frame);
      expect(a, frame.slot).toBeGreaterThanOrEqual(lo - EPS);
      expect(b, frame.slot).toBeLessThanOrEqual(hi + EPS);
    }
    // No two pieces share a stretch of the same wall face.
    const pieces = [
      ...plan.frames.map((f) => ({
        id: f.slot,
        wall: f.wall,
        face: f.gaze as string,
        span: span(f),
      })),
      ...plan.decor.map((d) => ({
        id: d.id,
        wall: d.wall,
        face: '',
        span: d.span,
      })),
    ];
    for (const p of pieces)
      for (const q of pieces) {
        const sameFace =
          p.wall === q.wall && (p.face === q.face || !p.face || !q.face);
        if (p !== q && sameFace)
          expect(
            p.span[0] >= q.span[1] || q.span[0] >= p.span[1],
            `${p.id} / ${q.id}`,
          ).toBe(true);
      }
  });

  it('keeps each viewing zone inside its section, clear and reachable', () => {
    for (const frame of plan.frames) {
      const zone = viewingZone(frame);
      const section = plan.sections.find((s) => s.id === frame.section)!;
      expect(inside(zone, section.rect), frame.slot).toBe(true);
      for (const block of solids)
        expect(overlaps(zone, block.rect), `${frame.slot} / ${block.id}`).toBe(
          false,
        );
      expect(
        plan.routes.some((route) => touches(zone, route.rect)),
        `${frame.slot} is off every route`,
      ).toBe(true);
    }
  });

  it('meets the route width targets and never passes through walls or furniture', () => {
    const minimum = {
      main: T.main_route_width,
      secondary: T.secondary_route_width,
      stair: T.stair_route_width,
    };
    for (const route of plan.routes) {
      const [x0, x1, y0, y1] = route.rect;
      expect(Math.min(x1 - x0, y1 - y0), route.id).toBeGreaterThanOrEqual(
        minimum[route.kind] - EPS,
      );
      for (const block of solids)
        expect(
          overlaps(route.rect, block.rect),
          `${route.id} / ${block.id}`,
        ).toBe(false);
    }
    for (const item of plan.furniture)
      for (const wall of plan.walls)
        expect(overlaps(item.rect, wall.rect), `${item.id} / ${wall.id}`).toBe(
          false,
        );
  });

  it('connects arrival, every section and the basement in at least one loop', () => {
    const routes = plan.routes;
    let edges = 0;
    for (let i = 0; i < routes.length; i++)
      for (let j = i + 1; j < routes.length; j++)
        if (touches(routes[i]!.rect, routes[j]!.rect)) edges++;
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const i = queue.shift()!;
      routes.forEach((route, j) => {
        if (!seen.has(j) && touches(routes[i]!.rect, route.rect)) {
          seen.add(j);
          queue.push(j);
        }
      });
    }
    expect(seen.size, 'every route joins the network').toBe(routes.length);
    // A connected graph with at least as many edges as nodes has a cycle.
    expect(edges).toBeGreaterThanOrEqual(routes.length);
    for (const section of plan.sections)
      expect(
        routes.some((route) => overlaps(route.rect, section.rect)),
        section.id,
      ).toBe(true);
    const [sx, sy] = plan.spawn.at;
    expect(
      routes.some(
        ({ rect: r }) => sx > r[0] && sx < r[1] && sy > r[2] && sy < r[3],
      ),
    ).toBe(true);
  });

  it('keeps the basement door landing and catalogue approach clear', () => {
    for (const zone of [
      plan.basement_door.landing_clear,
      plan.lectern.approach,
    ]) {
      for (const block of solids)
        expect(overlaps(zone, block.rect), block.id).toBe(false);
      expect(plan.routes.some((route) => touches(zone, route.rect))).toBe(true);
    }
    for (const wall of plan.walls)
      expect(overlaps(plan.lectern.rect, wall.rect), wall.id).toBe(false);
  });
});
