# Tactical Board Next

A modern, responsive, browser-based football tactical board for match analysis, set-piece design, and coaching sessions. Drag players, referees, and training equipment at 60fps, switch instant 11v11 formations, sketch curved tactical arrows in six styles, highlight tactical zones, animate multi-step plays on a keyframe timeline, organize schemes in a Collections Library, and export HD `.mp4` videos, animated `.gif` files, and `2x` `.png` images directly in the browser.

![Animated tactical sequence with arrows and player movements](docs/board-animation.gif)

> **Exported Video Demo:** [Download / Watch `docs/tactical-board-demo.mp4`](docs/tactical-board-demo.mp4) *(1280×720 HD, 30 fps, H.264 Main Profile + AAC, exported directly from the browser via FFmpeg.wasm)*

---

## Features

### 1. Instant Formations, Team Customizer & Multi-View Pitch
- **7 Built-in 11v11 Formations** for both Home and Away teams (`4-3-3`, `4-2-3-1`, `4-4-2`, `3-5-2`, `3-4-3`, `5-3-2`, `4-1-4-1`) — switch formations at any time while preserving player names, jersey numbers, and vision settings.
- **Custom Team Colors:** Live color pickers for both Home and Away kits.
- **4 Pitch Views & Toggles:**
  - `Full Horizontal` (standard 105×68 m view)
  - `Half Pitch (Left)` & `Half Pitch (Right)` (zoomed set-piece and pressing-trap views)
  - `Full Vertical` (coach's touchline / behind-goal perspective)
  - Toggleable **Mowed Grass Stripes**, **Pitch Lines (Markings)**, penalty spots, penalty arcs, and **3D Goal Nets**.

![Pro tactical toolbar, training equipment tray, and token inspector](docs/board-pro-features.png)

---

### 2. Six Tactical Arrow Styles, Zone Shapes, Text & Eraser
Click **Draw Tactical Arrows** or select any drawing tool directly:

| Tool | Visual | Coaching Purpose |
| :--- | :--- | :--- |
| **Pass** | Solid arrow | Ball passes, switches of play, crosses, and shots on goal |
| **Run** | Dashed arrow | Off-the-ball player runs, overlaps, underlaps, and pressing triggers |
| **Dribble** | Wavy sinusoidal arrow | Ball-carrier dribbles and driving into open space |
| **Target Zone** | Dashed arrow + target circle | Instructing a player to attack or occupy a specific space |
| **Block `┬`** | Solid line with perpendicular T-bar | Screening passing lanes, defensive blocks, and pressing walls |
| **Freehand** | Smooth freehand pencil stroke | Custom coaching sketches on the pitch |
| **Rect / Circle / Triangle Zone** | Semi-transparent dashed polygon | Highlighting pressing traps, overload zones, and defensive blocks |
| **Text** | Draggable on-pitch label (`S / M / L`) | Tactical cues and phase labels directly on the grass |
| **Eraser** | Single-click item remover | Click any individual arrow, shape, text label, or equipment item to remove it |

- **7 Drawing Ink Colors & 3 Stroke Weights (`Thin`, `Med`, `Thick`)**
- **Curved trajectories:** Every directional arrow (`Pass`, `Run`, `Dribble`, `Target Zone`, `Block ┬`) exposes a draggable **midpoint control handle** for smooth quadratic Bézier curves.
- **Per-Frame Coaching Notes:** Add a coaching subtitle to each step (rendered as a clean banner at the top of the pitch during playback and export).

![Tactical arrows — Pass, Run, Dribble, and Target Zone with curved handles](docs/board-arrows.png)

---

### 3. Training Equipment Tray & Player Token Inspector
Expand **`+ Equipment & Bench`** to spawn extra tokens and training gear directly onto the pitch:
- **Bench & Match Tokens:** `+ Home Player`, `+ Away Player`, `+ Referee`, `+ Ball` (multi-ball drills supported)
- **8 Vector Training Equipment Items:**
  - `Cone`, `Marker Disc`, `Hurdle`, `Agility Ladder`, `Slalom Pole`, `Mannequin Wall`, `Training Ring`, and rotatable `Mini-Goal`
- **Selected Token Inspector Bar:** Click any player or equipment token in Move mode to customize:
  - **Jersey Number** (`1–99`)
  - **Player Name / Role Tag** (rendered in a pill badge beneath the player token)
  - **Directional Vision Cone (`65°` FOV)** + **Facing Angle Slider (`0°–360°`)** to visualize body orientation and scanning angles
  - **Equipment Rotation (`+45°`)** and **Remove from Pitch**

---

### 4. Pitch Divisions & Analytical Zones Overlay
Toggle **Pitch Divisions** to overlay standard coaching analysis zones above the grass and beneath the players:

- **Three horizontal thirds:** *Defensive third*, *Middle third*, and *Final third*
- **Five vertical channels:** *Left wing*, *Left half-space* (amber tint), *Centre*, *Right half-space* (amber tint), and *Right wing*
- **Highlighted penalty areas:** Subtle analytical tint over both 18-yard boxes.

![Pitch divisions overlay](docs/board-divisions.png)

---

### 5. Keyframe Timeline, Step Playback, Scrubber & Ghosting
Build multi-phase tactical plays step by step:

- **Keyframe management:** `+ Frame`, `Duplicate`, `Delete`, `< 1 2 3 >` frame chips, and `←` / `→` keyboard navigation.
- **Smooth `Konva.Tween` playback:**
  - **`Play / Stop`:** Plays the full multi-step sequence with optional **`Loop`** mode.
  - **`Play Step`:** Animates just the single transition from the current frame to the next frame and pauses for step-by-step coaching walk-throughs.
  - Adjustable **Step duration slider** (`0.3s` to `3.0s` per transition).
- **Interactive `Scrub` slider** & **Ghost previous frame** (`30%` opacity tokens + dashed movement trails).

![Timeline with ghost trails and scrub controls](docs/board-timeline.png)

---

### 6. Client-Side PNG, Animated GIF & HD MP4 Export (`FFmpeg.wasm`)
Export your tactical board or animation without any server or watermark:

- **`Export PNG`:** Instant `2x` high-DPI (`2100×1360`) snapshot of the current frame.
- **`Export GIF`:** Synthesizes the full animated timeline and encodes a two-pass palette-optimized looping `.gif` (`840px` wide) directly in the browser via `FFmpeg.wasm`.
- **`Export MP4`:** Renders the full sequence at 30 fps and encodes a universally compatible **1280×720 HD** `.mp4` (`H.264 Main Profile Level 3.1`, `yuv420p`, `BT.709`, stereo `AAC` audio, `mp42 +faststart`) that plays natively in **Windows 11 Media Player**, **QuickTime**, **VLC**, and web browsers.

![3-frame tactical play and MP4 export](docs/board-export-mp4.png)

---

### 7. Collections Library, JSON Import/Export & Shareable URLs
- **Collections Library (`Collections` drawer):** Save up to 1,000 named tactical schemes in `localStorage` categorized as `Match Tactic`, `Set Piece`, or `Training Drill`, and load or delete them with one click.
- **Portable `.json` Backup:** Export your current board to a `.json` file or import any saved `.json` tactic file.
- **Zero-Backend Shareable Links (`Share Link`):** Encodes the entire multi-frame board state into `#scheme=<base64url>` in the URL and copies the link to the clipboard so opening the URL immediately restores the full animation.

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Z` (`Cmd + Z` on Mac) | Undo last action in the current frame |
| `Ctrl + Y` or `Ctrl + Shift + Z` | Redo last undone action in the current frame |
| `←` / `→` | Step to previous / next timeline frame |

---

## Tech Stack

- **Angular 22**: Standalone components, Angular Signals, `OnPush` change detection
- **NgRx Signals (`@ngrx/signals`)**: Single source of truth for timeline frames, formations, entity metadata, arrows, shapes, texts, and per-frame undo/redo stacks
- **Konva.js**: 2D HTML5 Canvas engine running outside the Angular zone (`NgZone.runOutsideAngular`) for 60fps interaction
- **FFmpeg.wasm (`@ffmpeg/core`)**: In-browser WebAssembly video and GIF encoding (`libx264`, `aac`, `palettegen`/`paletteuse`)
- **Tailwind CSS v3**: Dark tactical UI styling

## Architecture Notes

- `BoardStore` (`src/app/pitch-board/board.store.ts`) is the single source of truth. An Angular `effect()` synchronizes Konva nodes from store state whenever the active frame, entities, arrows, shapes, or texts change.
- Konva uses six dedicated layers for clean separation of concerns:
  1. `pitchLayer` — mowed grass stripes, pitch markings, penalty boxes/arcs, and 3D goal nets
  2. `divisionsLayer` — analytical thirds, channels, and half-space highlights
  3. `shapesLayer` — tactical rectangle, ellipse, and triangle zone overlays
  4. `ghostLayer` — previous-frame faded tokens and dashed movement trails
  5. `drawingLayer` — `Pass`, `Run`, `Dribble`, `Target Zone`, `Block ┬`, and `Freehand` arrows + curve handles + on-pitch text labels
  6. `entityLayer` — draggable player tokens (with nameplates & vision cones), referees, match balls, and 8 vector training equipment types

## Getting Started

```bash
npm install
ng serve
```

Then open `http://localhost:4200/` in your browser.

## Development, Testing & Agent Skills

The repository ships project skills in [`.agents/skills/`](.agents/skills) that document how the project is built, tested, analysed and documented:

| Skill | Covers |
| :--- | :--- |
| [`tactical-board-dev`](.agents/skills/tactical-board-dev/SKILL.md) | Architecture (store, Konva layers), conventions, adding arrow styles, git rules, definition of done |
| [`tactical-board-testing`](.agents/skills/tactical-board-testing/SKILL.md) | Type check, vitest, browser verification, regression checklist |
| [`tactical-board-analysis`](.agents/skills/tactical-board-analysis/SKILL.md) | Reproduce-first debugging, log of past root causes, next-feature analysis |
| [`readme-media`](.agents/skills/readme-media/SKILL.md) | Screenshots, GIF generation, demo MP4, README gallery |
| [`mp4-export-compat`](.agents/skills/mp4-export-compat/SKILL.md) | Encode settings that play on Windows 11, `0xc10100be` and 0 B fixes |

### Checks before a commit

```bash
npx tsc --noEmit -p tsconfig.app.json
npm test
```

## Roadmap

- [x] Proportional 11v11 pitch, classic football, and boundary-clamped 60fps drag & drop
- [x] 7 instant 11v11 formations (`4-3-3`, `4-2-3-1`, `4-4-2`, `3-5-2`, `3-4-3`, `5-3-2`, `4-1-4-1`), custom team colors, and 4 pitch views (`Full`, `Half Left`, `Half Right`, `Vertical`)
- [x] Mowed grass stripes, 3D goal nets, and analytical pitch divisions overlay
- [x] 6 tactical arrow styles (`Pass`, `Run`, `Dribble`, `Target Zone`, `Block ┬`, `Freehand`), curved Bézier handles, 7 ink colors, and 3 stroke weights
- [x] Tactical zone shapes (`Rect`, `Circle`, `Triangle`), draggable on-pitch text labels, per-frame coaching notes, and single-click item eraser
- [x] Training equipment tray (`Cone`, `Marker Disc`, `Hurdle`, `Agility Ladder`, `Slalom Pole`, `Mannequin Wall`, `Training Ring`, `Mini-Goal`, `Referee`, extra players & balls)
- [x] Player token inspector: custom jersey numbers, name/role badges, and directional `65°` vision cones
- [x] Keyframe timeline engine: `Play`, `Play Step`, `Loop`, scrub slider, step duration control, and ghost trails
- [x] Client-side `2x` PNG, animated GIF, and 720p H.264 MP4 video export with FFmpeg.wasm
- [x] Collections Library (up to 1,000 schemes), `.json` import/export, and `#scheme=` shareable URLs
- [ ] AI-driven tactical setups via natural language (planned in a dedicated phase)

## Author

Ahmed Mohamed
