---
name: tactical-board-testing
description: How to test Tactical Board Next: type checks, unit tests, browser UI verification through the browser subagent, MP4 export checks, and a regression checklist. Use before committing a feature or when the user reports a UI bug.
---

# Testing Tactical Board Next

## 1. Fast checks (always)
```powershell
npx tsc --noEmit -p tsconfig.app.json
npm test          # ng test (vitest + jsdom); only app.spec.ts exists, add store specs for new logic
```
Pure store logic (frames, undo/redo, save/load validation) should get vitest specs in `board.store.spec.ts`: it needs no canvas.

## 2. Browser verification (browser subagent, model `flash`)
Konva is canvas: assert via screenshots plus visible DOM state (active frame chip, enabled/disabled Undo/Redo, status text).
Prompt template, keep it short:
1. "Resize to 1024x840, reload http://localhost:4200/, click Reset."
2. The exact interaction (button names + canvas coordinates).
3. "Take a screenshot after each step and report what is visible."
Then **open the screenshot with `read_file`** and verify yourself; the subagent's claims are untrusted. Compare with `BROWSER_HOST_FACTS` (visited/blocked origins, latest screenshot).
Test odd viewports too (e.g. `953x800`): they produced odd canvas heights that broke export.

## 3. Regression checklist
| Area | Check |
| :--- | :--- |
| Drag | Players and ball drag, stay inside the pitch; locked during drawing, playback, export |
| Arrows | All 4 styles draw on first click, **starting on top of a token**; clicking a style button auto-enables drawing; curve handle bends the arrow; stray tap makes no arrow |
| History | Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z for moves, arrows, clear, reset |
| Save/Load/Reset | Reload page, Load restores all frames; old single-frame saves still load |
| Divisions | Labels not overlapping tokens; thirds/channels/half-spaces visible |
| Timeline | + Frame, Duplicate, Delete, chips, `←`/`→`, Play/Stop, Scrub snap, Step slider, ghost trails |
| Export | Status `MP4 exported`, non-zero file, passes `probe-mp4.js` and `check-windows-playback.ps1` (see `mp4-export-compat`) |

## 4. Server / sandbox notes
- `ng serve` must run as a daemon. Hitting it from `curl` in a different command will not work in the sandbox; use the browser subagent.
- Browser subagent needs the user to approve the `http://localhost:4200` origin; on timeout, ask and re-send.
- When the subagent says BLOCKED because a prompt was truncated, resend only the missing steps in a short message.
