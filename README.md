# Virtual Exhibition

Virtual Exhibition is a browser-based 3D academic art exhibition. Visitors will explore a twelve-display gallery, inspect artworks, and read essays in an embedded viewer. An optional Basement of Doom will be accessible through a separate doorway.

## Status

The current preview renders a greybox room in WebGL 2 from a stationary eye-height camera. The canvas resizes with the viewport, and rendering pauses when the tab is hidden. The project includes a validated twelve-entry exhibit manifest. The Doraemon academic essay is listed as awaiting assets. The eleven other entries reserve space for future content.

The planned first-person experience includes WASD and mouse controls, click and E interactions, collision and stair traversal, a pause menu, optional touch controls, and graphics and audio settings. A 2D directory will provide another route to the exhibition and its essays.

## Development

Use Node.js 24 and npm. Install the Chromium test browser once per machine.

```sh
npm ci
npx playwright install chromium
npm run dev
```

Open the URL Vite prints. Use a browser with WebGL 2 support to see the scene.

| Command                | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                 |
| `npm run typecheck`    | Check strict TypeScript types                     |
| `npm run lint`         | Run ESLint                                        |
| `npm run format:check` | Check formatting with Prettier                    |
| `npm run format`       | Apply Prettier formatting                         |
| `npm test`             | Run Vitest unit tests                             |
| `npm run test:e2e`     | Run Playwright Chromium smoke tests               |
| `npm run build`        | Type-check and produce the static site in `dist/` |
| `npm run preview`      | Serve the production build locally                |

## Stack and layout

- Strict TypeScript, Three.js, and Vite with vanilla HTML and CSS.
- Blender source files live in `assets-source/`. Optimized GLB assets and approved public content live in `public/`.
- `public/data/exhibits.json` is the source of truth for exhibit content and anchor assignments.
- `src/` contains the render preview, app bootstrap, manifest validation, types, and styles. Player, environment, audio, and UI modules will get their own directories as their features land.
- `tests/` contains Vitest and Playwright suites. GitHub Actions runs the lightweight Linux checks.
- PDF.js is planned for the in-app viewer and Web Audio API for gesture-initiated environmental audio.

See the [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md), [design](docs/DESIGN.md), [asset pipeline](docs/ASSET_PIPELINE.md), and [deployment plan](docs/DEPLOYMENT.md). Cloudflare Pages is the planned static host.
