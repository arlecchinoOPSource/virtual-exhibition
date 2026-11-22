# Roadmap

Project Foundation and the First-Person Engine are complete. Main Gallery is the next implementation scope and starts after the blockout layout is approved.

The performance targets are 60 FPS on desktop, 30 FPS on mobile, and approximately 10–20 MB for the initial gallery download. Load additional environments and PDFs on demand. Validate these targets on representative hardware and keep individual production assets within the hosting limit.

## 1. Project Foundation

### Initialize and verify the public repository

Set up the standalone public repository and baseline static preview.

**Dependencies.** None.

**Acceptance.** GitHub shows Public and default branch main; a Three.js perspective preview draws and resizes; its status handles load failure.

### Configure strict TypeScript and developer checks

Configure Node 24, Vite, ESLint, Prettier, and reproducible dependency installation.

**Dependencies.** Repository initialization.

**Acceptance.** A fresh checkout passes npm ci, typecheck, lint, formatting, and build.

### Write foundation documentation

Write overview, architecture, design, roadmap, asset pipeline, deployment, contributing, and security guidance.

**Dependencies.** Repository initialization.

**Acceptance.** All guides are linked and describe asset rights, module boundaries, and planned deployment.

### Add unit tests, browser smoke tests, and Linux CI

Use Vitest for manifest validation and Playwright Chromium for rendering, resizing, and startup failures.

**Dependencies.** Tooling and minimal preview.

**Acceptance.** Unit and browser suites pass; one Linux CI job runs typecheck, lint, formatting, unit tests, and build.

## 2. First-Person Engine

### Build the first-person renderer and camera loop

Promote the preview into a timed scene loop and an eye-height perspective camera in a simple room.

**Dependencies.** Verified Project Foundation and approval to begin Milestone 2.

**Acceptance.** The greybox loads with an eye-height view; resize and background tab restoration keep the camera stable.

### Implement WASD and pointer-lock camera controls

Add frame-rate-independent WASD, clamped mouse look, and Escape pause and release.

**Dependencies.** First-person renderer and camera loop.

**Acceptance.** WASD and mouse operate on Chromium and Firefox; Escape releases lock and clears held input; resume requires a gesture.

### Implement collision, gravity, and greybox traversal

Add collision proxies, player volume, ground detection, stairs, and a playable greybox route.

**Dependencies.** First-person controls.

**Acceptance.** A player cannot pass walls or display proxies, falls to the floor, and traverses test stairs without jumping.

### Add crosshair and click/E interaction

Use a center ray, distance threshold, and occlusion checks with a contextual prompt.

**Dependencies.** First-person controls and greybox collision.

**Acceptance.** Click and E trigger the same visible target within range; walls and pause block activation.

## 3. Main Gallery

### Block out the gallery in Blender

Model recessed walls, two freestanding islands, a small central partition, left spawn, and right basement opening.

**Dependencies.** Approved blockout layout and playable greybox.

**Acceptance.** The room fits the brief and offers a clear approach to all display surfaces and both ends.

### Create twelve anchors, frames, and gallery lights

Author Exhibit_01 through Exhibit_12, define a reusable frame and lighting fixtures, and confirm facing axes.

**Dependencies.** Gallery blockout.

**Acceptance.** Exactly twelve named anchors survive export; test frames face the walkway and remain readable under the lighting.

### Optimize and integrate the gallery GLB

Export render meshes, markers, and collision proxies; check naming, texture size, scale, and lighting in Three.js.

**Dependencies.** Approved layout, anchors, frames, and engine.

**Acceptance.** A fresh load spawns on the left; all twelve frames align; the gallery export meets the agreed transfer budget.

## 4. Exhibition System

### Populate exhibit displays from the typed manifest

Connect the twelve manifest entries to Blender anchors, titles, descriptions, and reusable frames; show eleven original placeholders.

**Dependencies.** Integrated gallery GLB and approved placeholder art.

**Acceptance.** Every anchor resolves once and displays content without edits to the Blender environment.

### Integrate the approved Doraemon essay and artwork interaction

Add the approved display image and PDF and let the visitor open exhibit details with an essay action.

**Dependencies.** Manifest-driven displays and explicit asset publication approval.

**Acceptance.** Display 01 opens its details and exposes its essay action; only approved files and metadata are public.

### Build the embedded PDF.js viewer

Lazy-load PDF.js and the selected document, add scroll and zoom, and coordinate pointer lock, focus, and input.

**Dependencies.** Artwork interaction interface; use an original test fixture while approval is pending.

**Acceptance.** Viewer is keyboard usable; closing preserves pose and focus; the game does not move while the viewer is open.

### Build an accessible 2D exhibition directory

Provide a conventional HTML route listing all exhibits and links to available essays.

**Dependencies.** Exhibit manifest and document interface.

**Acceptance.** The directory works without WebGL and all document actions work with keyboard and screen-reader navigation.

## 5. Basement of Doom

### Model the basement entrance, sign, and statue

Create the far-right doorway, original metal-style lettering, and a Grim Reaper statue.

**Dependencies.** Approved gallery geometry and art direction.

**Acceptance.** The sign reads BASEMENT OF DOOM and the statue and door leave the main gallery path clear.

### Animate the door and validate stairs

Connect click/E to the hinge animation and support gravity and collision on the stair route.

**Dependencies.** Basement entrance and engine traversal.

**Acceptance.** Repeated input does not leave the door and collider out of sync; visitors can descend and return.

### Author the Helvete-inspired basement and lighting

Create weathered concrete and plaster, handwritten BLACK METAL graffiti, a throne, candle stand, and exposed bulb.

**Dependencies.** Approved references and entrance blockout.

**Acceptance.** All specified original props are visible, the stairs remain legible, and external asset rights are recorded.

### Load the basement independently

Split the environment and optional audio into on-demand requests with failure recovery.

**Dependencies.** Basement export and door interaction.

**Acceptance.** A fresh gallery visit makes no basement asset requests; choosing to enter loads them; failure leaves the gallery usable.

## 6. Visual and Audio Polish

### Create the opening screen and pause menu

Explain controls, provide Resume and settings, and restore focus during transitions.

**Dependencies.** Working exploration controls.

**Acceptance.** Keyboard users can enter, pause, and resume the tour without trapped focus.

### Add visual effects and graphics settings

Implement approved effects and a lower-cost option including resolution control.

**Dependencies.** Integrated gallery and basement.

**Acceptance.** The settings change rendering behavior immediately and reduce measured GPU cost on a reference device.

### Add environmental audio and volume controls

Use Web Audio with volume and mute settings, attach ambience to environments, and require a visitor gesture.

**Dependencies.** Environment loading and approved audio.

**Acceptance.** No audio plays on load; mute and volume work after opt-in; leaving an environment stops its audio.

## 7. Testing and Optimization

### Validate desktop and mobile compatibility

Test supported desktop browsers, touch controls, viewport changes, and WebGL fallback.

**Dependencies.** Polished UI and supported-device list.

**Acceptance.** Record results for each browser and device; mobile navigation and the 2D directory remain usable.

### Test collision, exhibit actions, and PDF state

Exercise stairs, corners, occlusion, overlays, failure handling, and repeated actions.

**Dependencies.** Playable gallery, basement, and viewer.

**Acceptance.** Regression cases pass for wall blocking, stair traversal, click/E matching, scroll/zoom, and pose preservation.

### Compress assets and profile performance

Measure cold transfer, frame rate, and slow devices; compress model and texture files and record tradeoffs.

**Dependencies.** Release candidate assets.

**Acceptance.** Report desktop 60 FPS and mobile 30 FPS target results, initial transfer versus 10–20 MB, and per-file hosting limits.

### Review accessibility, security, and privacy

Audit keyboard/focus, contrast, screen readers, dependencies, document metadata, tracking, and asset rights.

**Dependencies.** Release candidate content and interface.

**Acceptance.** Record findings and resolve release blockers; verify no unauthorized files, default tracking, or autoplay.

## 8. Public Release

### Configure Cloudflare Pages and verify the production site

Deploy main via GitHub integration, verify the dist build, HTTPS, and asset serving.

**Dependencies.** Release approval and testing milestone.

**Acceptance.** A fresh production build deploys successfully and the public URL passes desktop and mobile smoke tests.

### Verify final content and publish version 1.0.0

Confirm final manifest, approvals, attribution, release notes, and a tagged version.

**Dependencies.** Production verification and final content approval.

**Acceptance.** Every approved document works, credits and known limitations are documented, and GitHub has a v1.0.0 release.
