# Virtual Exhibition

Virtual Exhibition is a browser-based 3D academic art exhibition. Visitors will explore a twelve-display gallery, inspect artworks, and read essays in an embedded viewer. An optional Basement of Doom will be accessible through a separate doorway.

## Status

Select **Start walk** to explore the main gallery blockout on desktop with WebGL 2. Use WASD to move, the mouse to look, and Escape to pause. Add `?env=greybox` to the URL for the greybox test room, where E or left click toggles a display light and stairs test traversal. The project includes a validated twelve-entry exhibit manifest. The Doraemon academic essay is listed as awaiting assets. The eleven other entries show original placeholder art. Look at a display to see its title and description.

Future milestones add the finished gallery, optional touch controls, and graphics and audio settings. A 2D directory will provide another route to the exhibition and its essays.

## Development

Use Node.js 24 and npm. Install the Chromium and Firefox test browsers once per machine.

```sh
npm ci
npx playwright install chromium firefox
npm run dev
```

Open the URL Vite prints. Run `npm run test:e2e -- --headed` for the native pointer-capture smoke tests. Linux CI can use a virtual display. Use a browser with WebGL 2 support to see the scene.

| Command                | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                 |
| `npm run typecheck`    | Check strict TypeScript types                     |
| `npm run lint`         | Run ESLint                                        |
| `npm run format:check` | Check formatting with Prettier                    |
| `npm run format`       | Apply Prettier formatting                         |
| `npm test`             | Run Vitest unit tests                             |
| `npm run test:e2e`     | Run Playwright Chromium and Firefox smoke tests   |
| `npm run build`        | Type-check and produce the static site in `dist/` |
| `npm run preview`      | Serve the production build locally                |

## Stack and layout

- Strict TypeScript, Three.js, and Vite with vanilla HTML and CSS.
- Blender source files live in `assets-source/`. Optimized GLB assets and approved public content live in `public/`.
- `public/data/exhibits.json` is the source of truth for exhibit content and anchor assignments.
- `src/` contains the app bootstrap and styles plus the `core` renderer, `player` controls and collision, `environments` greybox, `exhibition` manifest validation, and `types` modules. Audio and UI modules will get their own directories as their features land.
- `tests/` contains Vitest and Playwright suites. GitHub Actions runs the lightweight Linux checks.
- PDF.js is planned for the in-app viewer and Web Audio API for gesture-initiated environmental audio.

See the [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [design](docs/DESIGN.md), [asset pipeline](docs/ASSET_PIPELINE.md), and [deployment plan](docs/DEPLOYMENT.md). Cloudflare Pages is the planned static host.
