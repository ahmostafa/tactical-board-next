---
name: readme-media
description: Produce README screenshots, animated GIFs and demo MP4 videos for Tactical Board Next. Use when asked to refresh docs/ media, capture board screenshots, build a GIF of the arrow animation, export/verify the MP4, or update the README feature gallery.
---

# README media: screenshots, GIF, MP4

All media lives in `docs/` and is referenced from `README.md`. Current assets:

| File | What it shows |
| :--- | :--- |
| `board-pro-features.png` | Full toolbar (`Demos (3)`, `? Tour`, `Mode:`, `70%–200%` zoom), Token Inspector, vision cones, and protruding goal nets |
| `board-tour-demos.png` | Interactive 6-step onboarding feature tour (`? Tour`) and 3 built-in animated demo tactics (`Demos (3)`) |
| `board-arrows.png` | Pass / Run / Dribble / Target Zone / Block `┬` arrows, zone shapes, and text annotations |
| `board-empty-pitch-drill.png` | Empty Pitch (Free Build) mode, Drag-to-Pitch palette, cones/mannequins, and `⚽ GOAL!` celebration in the net |
| `board-vertical-view.png` | Full Vertical view with upright player numbers (`1–11`), Referee `R`, cone, and tactical arrows |
| `board-divisions.png` | 18-zone pitch divisions overlay (thirds, half-spaces, channels) |
| `board-timeline.png` | Timeline bar, ghost trails, scrub + step sliders, `Play Step`, `Loop`, and export buttons |
| `board-export-mp4.png` | Half-Pitch view with protruding goal net and Export PNG / GIF / MP4 controls |
| `board-animation.gif` | Looping GIF of the 11v11 High Press & Midfield Trap animation (top of README) |
| `tactical-board-demo.mp4` | 1280x720 H.264 export of the 11v11 High Press & Midfield Trap play |
| `drill-overload-animation.gif` | Looping GIF of the Empty Pitch 3v2 Overload Drill & Goal Scored (`⚽ GOAL!`) sequence |
| `drill-overload-demo.mp4` | 1280x720 H.264 export of the Empty Pitch 3v2 Overload Drill & Goal Scored play |

## Prerequisites
- Dev server on `http://localhost:4200/` (`npm start`). Start it with `IsDaemon: true`. A server started in the sandbox is not reachable from the user's browser.
- Run Node scripts from the **repo root** (they read `node_modules/@ffmpeg/core`).

## 1. Screenshots (browser subagent)
Delegate to the `browser` subagent (model `flash`). Always tell it:
1. Viewport `1024x840`, reload, click **Reset** first, so every shot starts from the kickoff formation.
2. Exact UI steps and pixel coordinates (see "Canvas coordinates" below). Keep each message short (<400 chars per step group): long prompts have been truncated and made the subagent stop with BLOCKED.
3. To click **Stop Drawing (Back to Dragging)** before moving players.
4. The subagent's screenshots land in `<artifactDir>/browser_evidence/<subagent-id>/final_step_N.png`. The paths it reports (`browser_sandbox/screenshots/...`) may not exist. Use `Get-ChildItem ... | Sort LastWriteTime` and `read_file` on the PNG to **verify visually** before copying into `docs/`.
5. If the subagent reports `ORIGIN_PERMISSION_REQUIRED` (60 s prompt timeout), ask the user to approve the origin and re-send.

### Canvas coordinates (1024x840 viewport, board at scroll top)
Pitch spans x≈16–992, y≈168–800. Kickoff positions: Red 6 (313,484), Red 10 (351,335), Red 9 (481,484), Blue 9 (528,484), ball (505,484), goal line right x≈992. Take a screenshot first and re-derive coordinates if the layout changed.

## 2. Demo MP4
Use the real feature: build 2-3 frames (`+ Frame`), draw arrows per frame, click **Export MP4**, wait for status `MP4 exported (tactical-board.mp4)`. The file lands in the browser agent's downloads folder (`<artifactDir>/browser_sandbox/downloads/tactical-board.mp4`). Copy to `docs/tactical-board-demo.mp4`.
Note: arrows are per-frame. Frame 1 arrows show only in frame 1 and fade into frame 2's arrows. If a transition looks empty, add arrows to the destination frame or check `playStep` / `exportMp4` fallback logic in `pitch-board.component.ts`.

## 3. Inspect the MP4
```powershell
node .agents/skills/readme-media/scripts/probe-mp4.js docs/tactical-board-demo.mp4 scratch/frames
```
Expect `h264 Main`, `1280x720`, `yuv420p`, `sample_aspect_ratio=1:1`, an AAC stream, duration ≈ 0.4s hold + steps + 0.6s hold. Read 2-3 of the dumped PNGs to confirm arrows and players are visible.

## 4. GIF
```powershell
node .agents/skills/readme-media/scripts/make-gif.js docs/tactical-board-demo.mp4 docs/board-animation.gif 20 840
```
Uses a two-pass palette (`palettegen` + `paletteuse`). Keep the GIF under ~500 KB: lower `fps` (15) or `width` (720) if larger. A GIF can also be built from a PNG sequence: `make-gif.js "frames/f_%04d.png" out.gif 10 840`.

## 5. Verify Windows playback
```powershell
powershell -NoProfile -File .agents/skills/readme-media/scripts/check-windows-playback.ps1 -Path docs\tactical-board-demo.mp4
```
Must print `OK: playable`. See the `mp4-export-compat` skill for what to change when it does not.

## 6. Update README
- GIF at the very top, video link right under it, one screenshot per feature section.
- Relative paths only (`docs/...`). Commit media together with the README.
- Commit as Ahmed Mohamed with a human message; **no AI or tool mentions** in commits, README or code comments.

## Gotchas
- `@ffmpeg/core` UMD in Node needs `global.self = { location: { href: 'file:///x' } }` and an explicit `wasmBinary` (the default `fetch('ffmpeg-core.wasm')` fails in Node).
- `core.reset()` between `exec()` calls; raw RGBA frame processing of 90 frames in one core instance can hit `memory access out of bounds`. Prefer ffmpeg filters (`overlay`, `fade`) over per-pixel JS.
- Screenshots from the subagent can be cropped/scrolled. Re-take instead of editing.
