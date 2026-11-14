---
name: tactical-board-analysis
description: Debugging and analysis playbook for Tactical Board Next: reproduce-first diagnosis, reading Konva/FFmpeg behaviour, Windows media checks, and how past issues were root-caused. Also covers deciding what to build next from best practice in football tactics tools. Use when a bug is reported or when planning features.
---

# Analysis playbook

## Debug loop
1. **Reproduce headlessly first** when possible (Node + `@ffmpeg/core`, store specs). Only then touch the UI.
2. Capture evidence: ffmpeg stderr via `core.setLogger`, `ffprobe` output, MP4 atom order (`ftyp, moov, free, mdat` = faststart OK), Windows playback state.
3. Change **one** variable at a time (size, SAR, profile, audio, brand) and re-test with the PowerShell playback check.
4. Verify in the real app through the browser subagent and look at the screenshot yourself.
5. Commit with a message that states the root cause.

## Case log (root causes found so far)
| Report | Root cause | Fix |
| :--- | :--- | :--- |
| Arrows hard to start, needed to click outside the player | `entityLayer` swallowed pointer events and handler required `e.target === stage` | `entityLayer.listening(draggable)`; only ignore `curve-handle` |
| FFmpeg worker 404 | assets served via `angular.json` that the running `ng serve` never reloaded | import core through the bundler, `wasmBinary` from `new URL(..., import.meta.url)` |
| Exported video 0 B | PNG height 679 (odd) with yuv420p | fixed `scale`/`pad` to even 1280x720 |
| `0xc10100be` in new Windows player, OK in old | non-aligned size, `SAR 680:679`, no audio, `isom` brand | H.264 Main 1280x720, `setsar=1`, AAC, `mp42` (see `mp4-export-compat`) |
| Demo video showed arrows in frame 1 only | arrows are per frame; transitions rendered only the destination frame's arrows | keep source arrows when destination has none; fade between sets |
| Node: `self is not defined` / `Failed to parse URL ffmpeg-core.wasm` | UMD core assumes a worker and fetches wasm | `global.self = {location:{href}}` + pass `wasmBinary` |

## Tools
- Time-box web research; prefer official docs. Error-code searches are noisy: always confirm a hypothesis with an experiment.
- Windows media stack test: `.agents/skills/readme-media/scripts/check-windows-playback.ps1`.
- Use subagents for browser work; keep their prompts short and concrete.

## Product analysis (what to build next)
Benchmarks: Tactical Pad, Coach Paint, Sport Sketchpad, Veo/Hudl Sportscode style tools. Users consistently want: drawn arrows with clear semantic styles (done), animation/export to share with players (done), formation presets and team colours/names, shapes (zones, lines, cones), frame notes/labels, GIF export for chat apps, import/export of boards as JSON, shareable links. Postponed by the user: AI tactical setups (needs its own plan).
Prioritise by: coach value per effort, no backend needed, keeps the store as single source of truth.
