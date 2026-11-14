---
name: tactical-board-dev
description: Architecture, conventions and workflow for developing Tactical Board Next (Angular + NgRx Signals + Konva). Use when adding features (arrow styles, timeline, overlays, export), changing the store, or committing/pushing.
---

# Developing Tactical Board Next

Stack: Angular 22 (standalone, signals, OnPush), `@ngrx/signals`, Konva 10 (outside Angular zone), Tailwind v3, `@ffmpeg/core` 0.12.

## Layout
- `src/app/pitch-board/models/tactical-board.models.ts`: TypeScript domain interfaces (`TacticalEntity`, `TacticalArrow`, `TacticalShape`, `TacticalText`, `Snapshot`), pitch dimensions (`1050x680`, goal mouth, outer apron), color presets, zoom levels, and SVG cursors.
- `src/app/pitch-board/board.store.ts` & `src/app/pitch-board/state/board-sanitizer.ts`: **single source of truth**. `frames[]` (entities + arrows + shapes + texts + note per frame), `currentFrame`, `stepDurationMs`, `squadPreset`, undo/redo history, and `sanitizeFrame()` JSON validation.
- `src/app/pitch-board/board-storage.ts`: `localStorage` Collections library (`tactical-board:collections:v1`) and `#scheme=` base64url URL hash codec.
- `src/app/pitch-board/formations.data.ts` & `src/app/pitch-board/demo-tactics.data.ts`: 7 11v11 formations, 5 squad presets (`11v11`, `9v9`, `7v7`, `5v5`, `empty`), 6 interactive tour steps, and 3 animated demo tactics.
- `src/app/pitch-board/canvas/`:
  - `pitch-renderer.ts`: stadium apron, mowed grass stripes, markings, protruding woven goal nets, classic football, and `"⚽ GOAL!"` banner.
  - `pitch-divisions.ts`: FIFA `105m × 68m` coordinate mapping (`getZone18`, `getZone20`, `getTacticalLocationSummary`) and multi-mode `drawPitchDivisions` (`thirds-channels`, `zones-18`, `zones-20` + independent `Zone 14`, `Golden Zone`, `Pockets`, and `Byline Cutback` sub-zones; see [references/pitch-divisions-reference.md](references/pitch-divisions-reference.md)).
  - `arrow-renderer.ts`: `computeArrowPath` (straight, quadratic Bézier curves, wavy dribbles, Target Zone trimming), `computeTBarPoints` (`Block ┬`), zone shapes, and ghost trails.
  - `entity-renderer.ts`: `syncEntityNodes` (players, balls, referees, equipment, vision cones, upright numbers/names) and `renderTextsOnLayer` (coaching note banner + draggable text labels).
  - `equipment-renderer.ts`: 9 vector training equipment shapes and catalog.
- `src/app/pitch-board/services/board-export.service.ts`: Injectable Angular service for `2x` PNG, animated GIF, and `1280x720` H.264 MP4 export via `FFmpeg.wasm`.
- `src/app/pitch-board/pitch-board.component.ts` + `.html` & `src/app/pitch-board/components/`: Main board orchestrator and 5 focused standalone UI sub-components (`TourDemosPanelComponent`, `EquipmentPaletteComponent`, `TokenInspectorComponent`, `CollectionsDrawerComponent`, `TimelineBarComponent`).
- Layers (bottom to top): `pitchLayer`, `divisionsLayer`, `shapesLayer`, `ghostLayer`, `drawingLayer`, `entityLayer`.

## Rules
1. State changes go through the store; Konva nodes are synced from it by an `effect()` (`syncFromStore`). Never mutate Konva as the source of truth, except transient tweens during playback/scrub/export (the store updates when playback stops).
2. All Konva work runs in `ngZone.runOutsideAngular`; use `ngZone.run` only to set signals from Konva callbacks.
3. Arrows are per frame. `ArrowStyle = 'pass' | 'run' | 'dribble' | 'zone'`; geometry in `computeArrowPath` / `updateArrowGroup`; curve control point is the draggable `curve-handle` (name matters, the drawing engine ignores mousedown on it).
4. Drawing mode: `updateDraggable()` toggles `entityLayer.listening(...)` so arrows can start on top of tokens. Do not re-add `if (e.target !== stage) return`.
5. Internal coordinates are fixed 1050x680; the stage is scaled by a `ResizeObserver`.
6. Adding an arrow style: extend `ArrowStyle`, the toolbar (`selectArrowStyle('x')`), `computeArrowPath`/`updateArrowGroup`, the README table, and the `board-arrows.png` screenshot.

## Workflow
```powershell
npm start                      # ng serve, http://localhost:4200 (daemon)
npx tsc --noEmit -p tsconfig.app.json   # fast type check before each commit
npm test                       # vitest via ng test
```
Dev-server gotchas: after editing `angular.json` or installing packages restart `ng serve`. `npm install` needs network (run unsandboxed).

## Git rules (strict)
- Author: `Ahmed Mohamed <engahmed.mostafa@yahoo.com>`; branch `main`; remote `origin` (github.com/ahmostafa/tactical-board-next).
- Human, specific commit messages: a subject line plus a short body explaining why. **Never** mention AI, assistants, Copilot, Claude, Gemini or generation, in commits, code comments or README.
- `git add/commit/push` need `BypassSandbox: true` (`.git/index.lock` and network). One logical change per commit; media goes with the README change that uses it.

## Definition of done
Type check passes, feature verified in the browser (see `tactical-board-testing`), README and screenshots updated if user-visible, committed and pushed.
