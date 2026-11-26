# Acceptance record: furnished redesign (#97)

This record checks the furnished redesign before release work starts. It was made on 2026-11-26 against `main` at `64ea7c3` (#96). It extends [VERIFICATION.md](VERIFICATION.md), which covers #89 and #96. Room furnishing records are in [ASSET_REGISTER.md](ASSET_REGISTER.md). This issue does not authorize deployment, publication or the merging of pending PRs.

## Content mapping

| Section  | Frames                                 | Furnishing (issue)                                                                                                     |
| -------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Studio   | Exhibit_01 (Doraemon, `ready`), 02, 03 | Easel, drafting table, watercolours on a cabinet, horse statue, bamboo panelling (#90, #91)                            |
| Street   | Exhibit_04–06                          | Building reliefs, original sari-sari store and house front, a generic old truck (not a jeepney), sidewalk, aloes (#95) |
| Reading  | Exhibit_07–09                          | Two shelves from one mesh, desk, quill and parchment, scrolls, terracotta (#92)                                        |
| Living   | Exhibit_10–12                          | Old TV on a cabinet, original coffee table with fruit, couch, display case, dining set, vase, teal (#93)               |
| Theater  | Exhibit_13–15                          | Original proscenium and drapes, tower, banner and window reliefs, benches, flower pot, burgundy (#94)                  |
| Basement | Exhibit_16–18                          | Existing throne, candle stand, radio, posters and graffiti; three warm picture lights (#96)                            |

Exhibit_02–18 are neutral placeholders. The two basement posters are decoration, not frame slots.

## Performance (#25)

**Setup:** MacBook Air, Apple M5, 16 GB, macOS 26.5.1. The build is served with `vite preview`. The window is 1280 × 720 at DPR 1, with default settings: 100% resolution, spotlights on, sound off.

- Firefox 159.0 runs on the GPU, which it reports as "Apple M1, or similar".
- Chromium 159.0.8154.6 runs on SwiftShader, a CPU renderer. Its times compare builds on this machine only. **They are not low-end hardware evidence.**

**Method:** the same as `VERIFICATION.md`. Each view is warmed for 3 s, sampled three times for 3 s, and the median run is reported. Draws and triangles come from wrapped WebGL2 draw calls.

| View                        | Draws | Triangles | Firefox median / p95 (ms) | Chromium SwiftShader median / p95 (ms) |
| --------------------------- | ----- | --------- | ------------------------- | -------------------------------------- |
| Elevator, doors open        | 64    | 82,082    | 16.7 / 17.6               | 400 / 400                              |
| Studio                      | 21    | 50,406    | 16.7 / 17.6               | 217 / 233                              |
| Reading, from the east end  | 53    | 75,318    | 16.7 / 17.6               | 350 / 350                              |
| Central band, catalogue end | 55    | 81,670    | 16.7 / 17.7               | 367 / 467                              |
| Street, looking east        | 34    | 56,204    | 16.7 / 17.7               | 250 / 300                              |
| Living room, looking west   | 27    | 57,310    | 16.7 / 17.7               | 217 / 233                              |
| Theater, facing the stage   | 17    | 39,782    | 16.7 / 17.7               | 217 / 267                              |
| Rear landing                | 27    | 52,055    | 16.7 / 17.6               | 233 / 250                              |
| Basement, walked in         | 77    | 85,992    | 16.7 / 17.7               | 267 / 300                              |

Firefox holds 60 Hz in every view.

**Cold transfer:** 6.39 MB in both browsers. Every request goes to the local origin only. The parts:

- `gallery.glb`: 5.63 MB
- JavaScript: 639 KB
- Doraemon artwork: 86 KB
- the rest: about 31 KB

Opening the basement adds `basement.glb` (1.45 MB).

**Models:**

| File           | Materials | Render triangles | Textures and memory                       | Lights            |
| -------------- | --------- | ---------------- | ----------------------------------------- | ----------------- |
| `gallery.glb`  | 33        | 80.7k            | 7 images, largest 2048² (37.3 MiB)        | 15 spots          |
| `basement.glb` | 21        | 16.6k            | 13 images, largest 2048 × 1024 (58.1 MiB) | 3 spots, 3 points |
| `frame.glb`    | 2         | 98               | none                                      | none              |

### Budget changes: owner review needed

These limits changed during furnishing. Assertions were raised, not removed.

**Transfer budget (`gallery.glb` + `frame.glb`): 5 MB → 6 MB in #94 (PR #107). It now measures 5.64 MB.**

- The shared shell is most of the file: the parquet is 1.16 MB, and fixtures and signage add 0.63 MB.
- Heavy props were simplified first, keeping 12–50% of their triangles. In #92 this halved the studio's props, from 1.62 MB to 0.78 MB.

**Draw cap: 58 → 67.** Each room adds one draw for its joined props and one or two for its wall finish. The shelves add one, and the shared glass adds one.

**Not yet tried:**

- per-room decoration loading, as the basement already does;
- meshopt or Draco compression;
- a lighter parquet.

The owner decides whether 6 MB stands or one of these comes first.

## Behaviour (#24, #62)

- **All 18 frames** (label, prompt, details, Escape, resume): `frames.spec.ts` passes in Firefox and Chromium.
- **Directory, essay viewer and PDF fallback:** `directory.spec.ts` and `preview.spec.ts` pass in Firefox.
- **Collision, route, door and stairs:** `route.test.ts`, `door.test.ts`, `basement-frames.test.ts` and the room tests in `gallery.test.ts` pass. The room tests also check that every frame's sightline is clear.
- **Load failure and recovery:** `preview.spec.ts`, `basement-frames.test.ts` and `radio.test.ts` pass. So do the checks for no audio or basement requests before opt-in.
- **Reduced graphics:** checked visually from the 50% screenshots for each room. The spotlights-off toggle has no automated test.

**Runs on `64ea7c3`:**

- `typecheck`, `lint`, `format:check`, `validate:models` and `build`: clean.
- `npm test`: 68/68.
- `npx playwright test`: 80 passed, 1 skipped and 7 failed, all in Chromium.
  - 5 are the known #69 pointer-lock timeouts in `preview.spec.ts`, the same set as at #89.
  - 2 are in `audio.spec.ts`: each timed out after 5 s waiting for the scene while the whole suite ran in parallel on SwiftShader. Rerun alone, they passed 8/8. This is the same timing class as #69.
- The Firefox basement-frames walk flaked once in #91 and once in #94. Each time it passed 3/3 on rerun.

## Accessibility, privacy and rights (#26)

**Rights:** every third-party model is credited, with its changes, in `public/models/CREDITS.md`. Each has a register row with its download date and SHA-256. Unused assets are recorded with their reason and were not committed.

**Privacy:**

- The artwork WebP has no EXIF or XMP chunk.
- The essay PDF has no author, creator or producer metadata.
- No credentials, `.env` files or reference images are tracked.
- A scan for keys, passwords and e-mail addresses found nothing.

**Requests and sound:** a cold load requests only the local origin. Sound stays off until opted in.

## Compatibility (#23)

- **Desktop:** Firefox and Chromium are covered above. Safari and WebKit were not run.
- **Mobile:** there are **no first-person touch controls**. The walk needs pointer lock and a keyboard. On phones, the accessible directory is the supported route to all 18 exhibits and the essay, and it needs no WebGL.
- **Low-end GPU:** not measured.

## Release hand-off (#27, #28)

1. **Owner decisions:**
   - accept the furnished rooms, using the screenshots in `docs/renders/shell/`;
   - accept the 6 MB transfer budget, or ask for loading or compression first;
   - accept the honest "generic old truck" in the street.
2. **#96:** the attended listening check for the basement radio.
3. **#69:** Chromium walk tests are not yet a reliable CI gate.
4. **#23 and #25:** check one real mobile device and one low-end GPU before 1.0.0.
5. **#27 and #28:** Cloudflare Pages, the production smoke test and the final content check are untouched here.

## Decision

- Decision: pending owner review.
- By / date:
