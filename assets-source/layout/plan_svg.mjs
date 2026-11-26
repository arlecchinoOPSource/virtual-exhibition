// Draws the redesign plan (redesign.json) as a dimensioned SVG, north up.
//
//   node assets-source/layout/plan_svg.mjs docs/renders/layout/redesign-plan.svg
import { readFileSync, writeFileSync } from 'node:fs';

const plan = JSON.parse(
  readFileSync(new URL('./redesign.json', import.meta.url), 'utf8'),
);
const S = 40; // pixels per metre
const [X0, X1, Y0, Y1] = [-17.5, 29, -10, 9];
const W = (X1 - X0) * S;
const H = (Y1 - Y0) * S + 120;
const px = (x) => ((x - X0) * S).toFixed(1);
const py = (y) => ((Y1 - y) * S).toFixed(1);
const rect = ([x0, x1, y0, y1], attrs) =>
  `<rect x="${px(x0)}" y="${py(y1)}" width="${((x1 - x0) * S).toFixed(1)}" height="${((y1 - y0) * S).toFixed(1)}" ${attrs}/>`;
const text = (x, y, s, attrs = '') =>
  `<text x="${px(x)}" y="${py(y)}" ${attrs}>${s}</text>`;
const size = ([x0, x1, y0, y1]) =>
  `${(x1 - x0).toFixed(1)} × ${(y1 - y0).toFixed(1)} m`;

const tint = {
  elevator: '#d9dde2',
  catalogue: '#efe9dc',
  studio: '#e3ead4',
  street: '#dce6ee',
  reading: '#f1dccd',
  living: '#d5ebe6',
  theater: '#eadbe6',
  rear: '#ece9e4',
  basement: '#dedad6',
};
const route = { main: '#2f7fc1', secondary: '#2f9e6a', stair: '#c97a2b' };
const out = [];

// One-metre grid with labels every two metres.
for (let x = Math.ceil(X0); x <= X1; x++)
  out.push(
    `<line x1="${px(x)}" y1="0" x2="${px(x)}" y2="${py(Y0)}" stroke="#eee" stroke-width="${x % 2 ? 0.5 : 1}"/>`,
  );
for (let y = Math.ceil(Y0); y <= Y1; y++)
  out.push(
    `<line x1="0" y1="${py(y)}" x2="${W}" y2="${py(y)}" stroke="#eee" stroke-width="${y % 2 ? 0.5 : 1}"/>`,
  );
for (let x = Math.ceil(X0 / 2) * 2; x <= X1; x += 2)
  out.push(text(x, Y0 + 0.15, `x ${x}`, 'class="axis" text-anchor="middle"'));
for (let y = Math.ceil(Y0 / 2) * 2; y <= Y1; y += 2)
  out.push(text(X1 - 0.1, y - 0.1, `y ${y}`, 'class="axis" text-anchor="end"'));

for (const s of plan.sections) out.push(rect(s.rect, `fill="${tint[s.id]}"`));
for (const r of plan.routes)
  out.push(
    rect(
      r.rect,
      `fill="${route[r.kind]}" fill-opacity="0.16" stroke="${route[r.kind]}" stroke-opacity="0.5" stroke-dasharray="6 4"`,
    ),
  );

// Viewing zones in front of each frame.
const t = plan.targets;
for (const f of plan.frames) {
  const [x, y] = f.at;
  const half = t.frame_width / 2 + t.viewing_margin;
  const d = t.viewing_depth;
  const zone = {
    N: [x - half, x + half, y - d, y],
    S: [x - half, x + half, y, y + d],
    E: [x - d, x, y - half, y + half],
    W: [x, x + d, y - half, y + half],
  }[f.gaze];
  out.push(rect(zone, 'fill="#f2a33a" fill-opacity="0.22" stroke="#d9822b"'));
}
out.push(
  rect(
    plan.lectern.approach,
    'fill="#f2a33a" fill-opacity="0.22" stroke="#d9822b" stroke-dasharray="3 3"',
  ),
);
out.push(
  rect(
    plan.basement_door.landing_clear,
    'fill="none" stroke="#b23" stroke-dasharray="3 3"',
  ),
);

for (const f of plan.furniture)
  out.push(
    rect(
      f.rect,
      `fill="#b59b78" fill-opacity="${f.note === 'existing' ? 0.9 : 0.55}" stroke="#7a6248"`,
    ),
  );
for (const w of plan.walls) out.push(rect(w.rect, 'fill="#333"'));
out.push(rect(plan.lectern.rect, 'fill="#6b4a2b"'));
const [ex0, ex1, ey0, ey1] = plan.elevator.doors;
out.push(rect([ex0 - 0.15, ex1, ey0, ey1], 'fill="#999"'));

// Existing posters and graffiti: grey bars on the basement-side face of
// their walls, labelled just inside the room.
const [bx0, bx1, by0, by1] = plan.sections.find(
  (s) => s.id === 'basement',
).rect;
const [bcx, bcy] = [(bx0 + bx1) / 2, (by0 + by1) / 2];
for (const d of plan.decor) {
  const [x0, x1, y0, y1] = plan.walls.find((w) => w.id === d.wall).rect;
  const [a, b] = d.span;
  const across = x1 - x0 > y1 - y0;
  const face = across ? (bcy < y0 ? y0 : y1) : bcx < x0 ? x0 : x1;
  const inward = across ? Math.sign(bcy - face) : Math.sign(bcx - face);
  const bar = across
    ? [a, b, face - 0.08, face + 0.08]
    : [face - 0.08, face + 0.08, a, b];
  out.push(rect(bar, 'fill="#8a8a8a"'));
  const [lx, ly] = across
    ? [(a + b) / 2, face + inward * (inward > 0 ? 0.45 : 0.6)]
    : [face + inward * 0.25, (a + b) / 2];
  const anchor = across ? 'middle' : inward > 0 ? 'start' : 'end';
  out.push(
    text(
      lx,
      ly,
      d.id.startsWith('Poster') ? 'poster' : 'graffiti',
      `class="note" text-anchor="${anchor}"`,
    ),
  );
}

// Frames: a heavy bar on the wall face and the slot number on the floor side.
for (const f of plan.frames) {
  const [x, y] = f.at;
  const h = t.frame_width / 2;
  const bar =
    f.gaze === 'N' || f.gaze === 'S'
      ? [x - h, x + h, y - 0.06, y + 0.06]
      : [x - 0.06, x + 0.06, y - h, y + h];
  out.push(rect(bar, 'fill="#b0122b"'));
  const [lx, ly] = {
    N: [x, y - 0.75],
    S: [x, y + 0.6],
    E: [x - 0.75, y - 0.1],
    W: [x + 0.75, y - 0.1],
  }[f.gaze];
  out.push(text(lx, ly, f.slot.slice(-2), 'class="slot" text-anchor="middle"'));
}

// Spawn arrow facing east, door swing, labels.
const [sx, sy] = plan.spawn.at;
out.push(
  `<path d="M${px(sx - 0.4)},${py(sy + 0.35)} L${px(sx + 0.45)},${py(sy)} L${px(sx - 0.4)},${py(sy - 0.35)} Z" fill="#1d5fa0"/>`,
);
out.push(text(sx - 1.0, sy - 0.1, 'Spawn', 'class="note" text-anchor="end"'));
out.push(text(-8.7, -1.45, 'Catalogue', 'class="note"'));
// The basement door: closed across its opening, swinging 90° into the
// stairwell, away from the gallery side.
const [hx, hy] = plan.basement_door.hinge;
const [ox0, ox1, oy0, oy1] = plan.basement_door.opening;
const [lx0, lx1, ly0, ly1] = plan.basement_door.landing_clear;
const closed =
  ox1 - ox0 > oy1 - oy0
    ? [Math.abs(hx - ox0) < 0.01 ? ox1 : ox0, hy]
    : [hx, Math.abs(hy - oy0) < 0.01 ? oy1 : oy0];
const away =
  ox1 - ox0 > oy1 - oy0
    ? [0, Math.sign(hy - (ly0 + ly1) / 2) * 1.6]
    : [Math.sign(hx - (lx0 + lx1) / 2) * 1.6, 0];
const swung = [hx + away[0], hy + away[1]];
// Sweep direction in SVG space (y down) from the closed to the open leaf.
const v1 = [closed[0] - hx, hy - closed[1]];
const v2 = [swung[0] - hx, hy - swung[1]];
const sweep = v1[0] * v2[1] - v1[1] * v2[0] > 0 ? 1 : 0;
out.push(
  `<path d="M${px(hx)},${py(hy)} L${px(closed[0])},${py(closed[1])} A${1.6 * S},${1.6 * S} 0 0 ${sweep} ${px(swung[0])},${py(swung[1])}" fill="none" stroke="#b23" stroke-width="1.2"/>`,
);
out.push(text(12.0, 1.25, 'Stairs down, east (1.6 m)', 'class="note"'));
for (const s of plan.sections) {
  const [x0, x1, , y1] = s.rect;
  out.push(
    text(
      (x0 + x1) / 2,
      y1 - 0.55,
      s.id.toUpperCase(),
      'class="room" text-anchor="middle"',
    ),
  );
  if (y1 - s.rect[2] >= 3)
    out.push(
      text(
        (x0 + x1) / 2,
        y1 - 0.95,
        size(s.rect),
        'class="note" text-anchor="middle"',
      ),
    );
}
out.push(
  text(
    bcx,
    by0 - 0.7,
    'Basement floor z −3.06 m',
    'class="note" text-anchor="middle"',
  ),
);

// Overall dimensions of the upstairs footprint.
const tick = 'marker-start="url(#tick)" marker-end="url(#tick)" stroke="#555"';
out.push(
  `<line x1="${px(-14.2)}" y1="${py(8.4)}" x2="${px(10.2)}" y2="${py(8.4)}" ${tick}/>`,
  text(
    -2,
    8.6,
    '24.4 m outside, 24.0 m inside',
    'class="dim" text-anchor="middle"',
  ),
  `<line x1="${px(-16.9)}" y1="${py(-9.2)}" x2="${px(-16.9)}" y2="${py(7.7)}" ${tick}/>`,
  `<text class="dim" transform="translate(${px(-17.1)},${py(-0.75)}) rotate(-90)" text-anchor="middle">16.9 m outside, 16.5 m inside</text>`,
);

const legend = [
  ['#2f7fc1', 'Main route, 2.0 m'],
  ['#2f9e6a', 'Secondary route, 1.2–1.5 m'],
  ['#c97a2b', 'Existing stair, 1.6 m'],
  ['#f2a33a', 'Viewing zone, 1.7 × 1.5 m'],
  ['#b59b78', 'Furniture envelope (planning size)'],
  ['#b0122b', 'Frame slot (Exhibit_NN)'],
];
legend.forEach(([colour, label], i) => {
  const lx = 20 + (i % 3) * 420;
  const ly = (Y1 - Y0) * S + 40 + Math.floor(i / 3) * 34;
  out.push(
    `<rect x="${lx}" y="${ly - 14}" width="26" height="18" fill="${colour}" fill-opacity="0.6"/>`,
    `<text x="${lx + 36}" y="${ly}" class="legend">${label}</text>`,
  );
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">
<title>Exhibition redesign plan (issue #86), accepted 2026-11-26</title>
<defs><marker id="tick" viewBox="0 0 2 10" refX="1" refY="5" markerWidth="2" markerHeight="10" orient="auto"><rect width="2" height="10" fill="#555"/></marker></defs>
<style>.axis{font-size:11px;fill:#999}.room{font-size:15px;font-weight:700;fill:#333;letter-spacing:1px}.note{font-size:12px;fill:#444}.slot{font-size:13px;font-weight:700;fill:#b0122b}.dim{font-size:13px;fill:#333}.legend{font-size:14px;fill:#333}</style>
<rect width="${W}" height="${H}" fill="#fff"/>
${out.join('\n')}
</svg>
`;
writeFileSync(process.argv[2] ?? 'redesign-plan.svg', svg);
console.log(`wrote ${W} × ${H} px`);
