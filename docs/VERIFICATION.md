# Verification record: walkable 18-frame milestone (#89)

This record checks the walkable layout (#86, #87, #88) before any room is furnished. It was made on 2026-11-26 against `main` at `a16a61c` (PR #101) plus the new `tests/e2e/frames.spec.ts`. Automated results and the owner's decision are kept apart: the decision at the end closes the gate.

## Route

`tests/unit/route.test.ts` walks the exported collision geometry at 3.2 m/s. Each leg must be reached without getting stuck, the visitor must stay on the floor outside the stairwell, and must stand grounded at each point. The route, in order:

1. Out of the elevator into the studio, round all four studio corners.
2. Through the opening to the street, its corners, the rear landing's corners, and past the statue to the basement door.
3. Door opened, south down the stairs, round the basement's corners clear of the throne, candle stand and radio, then back up the stairs (the reverse traversal) and out through the door.
4. The reading area's east end and corners to the catalogue end of the band.
5. The living room's four corners, through to the theater, its four corners, out through the theater door, then back through the studio into the elevator.

Result: passes. It fails as expected when a leg is sent through a wall.

## Frames

`tests/e2e/frames.spec.ts` reaches every frame from the keyboard alone (Enter to start, E to open, Escape to close, Enter to resume):

- **Upstairs (15):** the test spawn is moved 2 m in front of each frame, facing it.
- **Basement (3):** the visitor opens the door and walks in, stopping at the throne, then turns and walks or steps to each frame. The basement loads only when its door opens.

For each frame the spec checks that:

- the label shows the manifest title;
- the prompt reads `E / Click · View details`;
- the details dialog opens with that title;
- Read the essay appears only for Exhibit_01, the published Doraemon essay;
- Escape returns focus to Resume walk, and resuming shows the same label again.

Result: all 18 frames pass in Firefox and in Chromium. Exhibit_01 is `ready` with its artwork and PDF, and Exhibit_02–18 are neutral placeholders. The essay viewer, the PDF fallback and the accessible directory (all 18 entries, without WebGL or the basement) are covered by `preview.spec.ts` and `directory.spec.ts`.

## Basement door, stairs and loading

These are covered by automated tests:

| Behaviour                                                                            | Tests                                        |
| ------------------------------------------------------------------------------------ | -------------------------------------------- |
| Door blocking and swing, collider in sync, no closing on a visitor in the doorway    | `door.test.ts`                               |
| Stairs down and up at 30, 60 and 144 fps                                             | `door.test.ts`                               |
| No basement requests before the door opens                                           | `preview.spec.ts`                            |
| Failed load keeps the gallery usable, then retries                                   | `preview.spec.ts`; `basement-frames.test.ts` |
| Exit and re-entry: the basement loads once and keeps exactly three frames            | `basement-frames.test.ts`                    |
| A missing or misassigned slot frees the model; a late load after disposal is dropped | `basement-frames.test.ts`                    |
| Basement ambience below ground, and the radio's single source, distance and stop     | `audio.spec.ts`                              |

## Performance baseline

**Setup:**

- Hardware: MacBook Air, Apple M5 (10-core CPU, 8-core GPU), 16 GB, macOS 26.5.1.
- Build: `vite preview` of the production build.
- Window: 1280 × 720 viewport at device pixel ratio 1, with the default settings (resolution 100%, spotlights on, sound off).
- Browsers, both run headless through Playwright:
  - Firefox 159.0 reports "Apple M1, or similar", its masked name for the Apple GPU.
  - Chromium 159.0.8154.6 renders with SwiftShader, the CPU software renderer used for CI, so its frame times are not a GPU measure.

**Method:** every view was warmed for 3 s after loading, which covers shader compiles and texture uploads. It was then sampled three times for 3 s each, and the run with the median frame time is reported. Draws and triangles are counted per frame by wrapping WebGL2's draw calls.

**Cold transfer** for the first load is 3.67 MB, the same in both browsers:

- `gallery.glb`: 2.91 MB
- the JavaScript bundle: 639 KB
- the Doraemon artwork: 86 KB
- the rest: about 30 KB

Opening the basement adds `basement.glb`, 1.45 MB. Chromium's larger count also includes in-memory `blob:` textures, which are not network transfer.

**Geometry and textures:**

- `gallery.glb`: 25 render primitives with 23 materials, 43.2 k triangles including collision proxies, and 6 images.
- `frame.glb`: 2 materials and 98 triangles, used 18 times.
- `basement.glb`: 21 materials, 17.0 k triangles, 13 images.
- GPU texture memory, estimated as RGBA plus mipmaps:
  - upstairs about 57.6 MiB: gallery textures 36.0, Doraemon 7.6, and 14 placeholder canvases 14.0;
  - the basement adds about 61.1 MiB: its textures 58.1 and 3 placeholders 3.0.

**Per view:**

| View                        | Draws | Triangles | Firefox median / p95 (ms) | Chromium SwiftShader median / p95 (ms) |
| --------------------------- | ----- | --------- | ------------------------- | -------------------------------------- |
| Elevator, doors open        | 51    | 44,460    | 16.7 / 17.6               | 283 / 300                              |
| Studio                      | 14    | 34,604    | 16.7 / 17.5               | 150 / 167                              |
| Central band, catalogue end | 42    | 44,048    | 16.7 / 17.5               | 233 / 250                              |
| Street                      | 26    | 41,446    | 16.7 / 17.4               | 183 / 200                              |
| Living room                 | 7     | 34,290    | 16.7 / 17.6               | 100 / 117                              |
| Theater                     | 18    | 41,054    | 16.7 / 17.3               | 150 / 167                              |
| Rear landing                | 20    | 41,152    | 16.7 / 17.6               | 183 / 233                              |
| Basement, walked in         | 64    | 48,370    | 16.7 / 17.5               | 167 / 367                              |

**Reading the numbers:**

- Firefox holds the 60 Hz frame interval in every view, so the GPU has headroom on this machine. Frame time can't fall below 16.7 ms while it is tied to the display's refresh rate.
- The SwiftShader numbers are useful only for comparing builds on the same machine, as #69 notes.
- A low-end GPU and a mobile device were not measured; that remains #23 and #25.
- Positions come from moving the spawn in the served GLB, which the tests already use. A runtime teleport for measurements stays with #69.

## Repository checks

Run on this branch:

- `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run build`: clean. The build shows the same chunk-size warning as before.
- `npm test`: 62/62 pass.
- `npx playwright test`: 82 pass and 1 is skipped (the SwiftShader-only cost test in Firefox). 5 fail, all in Chromium `preview.spec.ts`: "captures the pointer…", "labels a gallery display…", "opens exhibit details…", "reads the essay…" and "offers the PDF file…".
  - Each one times out waiting for pointer lock before it acts, and one runs in the greybox, so none depend on this layout.
  - This is the known #69 issue. The same flows pass in Firefox, and `frames.spec.ts` covers labels and details in Chromium without relying on pointer lock.

## Screenshots

- Overview: [top-down render](renders/shell/overview.jpg) and [plan](renders/layout/redesign-plan.svg).
- Player's-eye views in `renders/shell/`:
  - the elevator, as `elevator-1-closed`, `elevator-2-opening`, `elevator-3-open` and `elevator-5-inside-panel`;
  - each room: `studio`, `street`, `reading`, `living`, `theater` and `rear`;
  - `arrival`, along the central band;
  - the basement: `basement-stairs` and `basement-room`.

## Known limits carried forward

- **Basement frames** were lit only by the room's bulbs and read dimly. Resolved in #96: see below.
- **Rooms** were undecorated at #89. They are furnished in #91–#95; see `docs/ASSET_REGISTER.md`.
- **Chromium pointer lock** and a deterministic runtime teleport remain #69.

## Decision

The owner accepted the walkable layout on 2026-11-26. Accepting records that the spatial layout, with the arrival elevator in the studio and the basement through the cut-away corner, is approved before furnishing begins in #90–#95.

- Decision: accepted; furnishing may begin (#90–#95).
- By / date: the owner, 2026-11-26, in review of PR #102.

## Basement reconciliation (#96)

Checked on 2026-11-26 against `main` at `32baae6` (#95), plus this change. The basement's existing work is reused, not rebuilt:

- the radio model (#60, PR #84) and its playback (#61, PR #85, merged before this issue);
- the posters (#59, PR #83);
- the lighting (#58, PR #70);
- the statue (#52, PR #63).

**What changed:** each basement frame (Exhibit_16, 17 and 18) gets its own warm picture light, a spot 0.15 m under the low ceiling and 0.9 m out from the wall. It ships in `basement.glb`, so nothing loads before the door opens. The Display spotlights setting now reaches the basement's render pass as well as the gallery's. Nothing else in the basement moved.

**Automated results:**

| Requirement                                                                                                                    | Evidence                                                             | Result                       |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ---------------------------- |
| Three frames work like the rest: click/E, label, details, Escape back to the walk                                              | `frames.spec.ts`, basement test                                      | Pass in Firefox and Chromium |
| The frames appear in the directory and viewer                                                                                  | `directory.spec.ts`, `preview.spec.ts`; `basement-frames.test.ts`    | Pass                         |
| One picture light per frame, aimed at it, warm                                                                                 | `basement-frames.test.ts` ("light each basement frame…")             | Pass                         |
| The two posters stay independent decoration, not frame slots                                                                   | `redesign.json` `decor`; `layout-plan.test.ts` (18 unique slots)     | Pass                         |
| Frames clear of the stairs, throne, graffiti, radio and candle stand                                                           | `layout-plan.test.ts`; `route.test.ts` (basement corners)            | Pass                         |
| Door, stairs at 30/60/144 fps, exit and re-entry after the relocation                                                          | `door.test.ts`; `basement-frames.test.ts` (loads once, three frames) | Pass                         |
| Radio emitter on the relocated model, with named parts bound                                                                   | `door.test.ts` ("models the radio…")                                 | Pass                         |
| Sound off by default; no audio or basement request before opt-in and door                                                      | `audio.spec.ts`; `radio.test.ts`; `preview.spec.ts`                  | Pass in Firefox and Chromium |
| Master volume and mute; ambience switch below ground                                                                           | `audio.spec.ts`                                                      | Pass                         |
| One source through power and zone changes; hidden-tab fade; blocked-audio retry; failed-track retry; late track after disposal | `radio.test.ts`                                                      | Pass                         |
| One radio loop, fetched only once the door opens                                                                               | `audio.spec.ts`                                                      | Pass in Firefox and Chromium |
| Failed basement load keeps the gallery usable, then retries                                                                    | `preview.spec.ts`; `basement-frames.test.ts`                         | Pass                         |

**Runs:**

- `npm test`: 68/68.
- `npx playwright test --project=firefox`: 43 passed, 1 skipped.
- Chromium `audio.spec.ts` and `frames.spec.ts`: 20/20.

**Screenshots:** in `docs/renders/shell/`, at 100% and 50% resolution:

- `basement-frames-east`, showing Exhibit_16 and 17 with the Kittelsen poster between them;
- `basement-frames-west`, showing Exhibit_18 and the Doré poster;
- `basement-frames-south`, showing the room with the throne, graffiti, candle stand and radio.

**Not automated: attended listening check.** Nobody has yet listened for near and far attenuation, the radio's character, or the hand-off from the gallery ambience. The automated tests prove there is one source, along with its gains and lifecycle, but not how it sounds. This stays open for the owner. Record it here with the date, browser and output device once done.

**Limits:**

- The picture lights have no visible fixture: the basement's bulbs are its only lamps.
- With Display spotlights off, the basement frames fall back to the bulbs.
