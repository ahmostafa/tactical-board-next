---
name: tactical-board-dev
description: Architecture, conventions and workflow for developing Tactical Board Next (Angular + NgRx Signals + Konva). Use when adding features (arrow styles, timeline, overlays, export), changing the store, or committing/pushing.
---

# Developing Tactical Board Next

Stack: Angular 22 (standalone, signals, OnPush), `@ngrx/signals`, Konva 10 (outside Angular zone), Tailwind v3, `@ffmpeg/core` 0.12.

## Layout
- `src/app/pitch-board/board.store.ts`: **single source of truth**. `frames[]` (entities + arrows per frame), `currentFrame`, `stepDurationMs`, undo/redo history, save/load (`localStorage` key `tactical-board:v1`).
- `src/app/pitch-board/pitch-board.component.ts`: Konva stage, layers, drawing engine, playback, scrub, MP4 export, toolbar template.
- Layers (bottom to top): `pitchLayer`, `divisionsLayer`, `ghostLayer`, `drawingLayer`, `entityLayer`.

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
