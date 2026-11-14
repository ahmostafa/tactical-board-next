import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ChangeDetectionStrategy,
  inject,
  signal,
  effect,
  computed,
  HostListener,
} from '@angular/core';
import Konva from 'konva';
import {
  BoardStore,
  TacticalEntity,
  TacticalArrow,
  ArrowStyle,
  ShapeKind,
  TacticalShape,
  TacticalText,
  EquipmentKind,
} from './board.store';
import { FORMATION_NAMES, FormationName } from './formations.data';
import { EQUIPMENT_CATALOG, PITCH_ALIGNED_EQUIPMENT, renderEquipmentShape } from './equipment-renderer';
import {
  SavedCollectionItem,
  loadCollections,
  saveToCollections,
  deleteFromCollections,
  encodeSchemeHash,
  decodeSchemeHash,
} from './board-storage';

const STORAGE_KEY = 'tactical-board:v1';

export type PitchViewMode = 'full' | 'half-left' | 'half-right' | 'vertical';
export type ActiveToolMode = 'move' | 'arrow' | 'shape' | 'text' | 'eraser';

export const TEAM_COLOR_PRESETS = [
  { name: 'Red', hex: '#e74c3c' },
  { name: 'Blue', hex: '#3498db' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'White', hex: '#f3f4f6' },
  { name: 'Black', hex: '#1f2937' },
  { name: 'Pink', hex: '#ec4899' },
];

export const DRAWING_COLORS = [
  { name: 'Amber', hex: '#f1c40f' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Cyan', hex: '#38bdf8' },
  { name: 'Green', hex: '#4ade80' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Pink', hex: '#f472b6' },
];

/** Builds a CSS cursor value from an inline SVG with a hotspot and a keyword fallback. */
function svgCursor(svg: string, hotX: number, hotY: number, fallback: string): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;
}

const ERASER_SVG = (body: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
  `<g transform='rotate(-45 12 12)'>` +
  `<rect x='4' y='7' width='16' height='10' rx='2' fill='${body}' stroke='#111827' stroke-width='1.5'/>` +
  `<rect x='4' y='7' width='6' height='10' rx='2' fill='#f9fafb' stroke='#111827' stroke-width='1.5'/>` +
  `</g></svg>`;

export const CURSORS = {
  eraser: svgCursor(ERASER_SVG('#f472b6'), 5, 19, 'pointer'),
  eraserHot: svgCursor(ERASER_SVG('#ef4444'), 5, 19, 'pointer'),
  pencil: svgCursor(
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
      `<path d='M3 21l1.5-5L16 4.5a2.1 2.1 0 013 3L7.5 19z' fill='#facc15' stroke='#111827' stroke-width='1.5' stroke-linejoin='round'/>` +
      `<path d='M3 21l1.5-5 3 3z' fill='#111827'/></svg>`,
    3,
    21,
    'crosshair'
  ),
};

/** Pitch goal mouth and outer apron margins (internal 1050x680 coordinates). */
const GOAL_WIDTH = 73.2;
const GOAL_TOP = (680 - GOAL_WIDTH) / 2;
const GOAL_DEPTH = 20;
const PITCH_PAD_X = 36;
const PITCH_PAD_Y = 24;
const FULL_VIEW_W = 1050 + PITCH_PAD_X * 2; // 1122
const FULL_VIEW_H = 680 + PITCH_PAD_Y * 2; // 728
const HALF_VIEW_W = PITCH_PAD_X + 525 + 6; // 567 (outer apron + protruding goal net -> halfway line)

@Component({
  selector: 'app-pitch-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full max-w-6xl mx-auto p-3 text-white">
      <!-- Row 1: Primary Drawing, Arrow Styles, Overlays, History & File Controls -->
      <fieldset class="flex flex-wrap items-center gap-2 mb-2 border-0 p-0 m-0 min-w-0" [disabled]="isPlaying() || isExporting()">
        <button (click)="toggleDrawingMode()"
                class="px-3 py-1.5 text-sm text-white font-bold rounded shadow-md transition-colors"
                [class.bg-blue-600]="!isDrawingMode()"
                [class.bg-red-600]="isDrawingMode()">
          {{ isDrawingMode() ? 'Stop Drawing (Back to Dragging)' : 'Draw Tactical Arrows' }}
        </button>

        <!-- Line & Arrow Styles -->
        <div class="inline-flex rounded shadow-md overflow-hidden" role="group" aria-label="Arrow style">
          <button (click)="selectArrowStyle('pass')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white transition-colors"
                  [class.bg-amber-600]="activeTool() === 'arrow' && arrowStyle() === 'pass'"
                  [class.bg-gray-700]="!(activeTool() === 'arrow' && arrowStyle() === 'pass')"
                  title="Solid arrow for passes">Pass</button>
          <button (click)="selectArrowStyle('run')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-amber-600]="activeTool() === 'arrow' && arrowStyle() === 'run'"
                  [class.bg-gray-700]="!(activeTool() === 'arrow' && arrowStyle() === 'run')"
                  title="Dashed arrow for off-the-ball runs">Run</button>
          <button (click)="selectArrowStyle('dribble')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-amber-600]="activeTool() === 'arrow' && arrowStyle() === 'dribble'"
                  [class.bg-gray-700]="!(activeTool() === 'arrow' && arrowStyle() === 'dribble')"
                  title="Wavy arrow for ball carrier dribbles">Dribble</button>
          <button (click)="selectArrowStyle('zone')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-amber-600]="activeTool() === 'arrow' && arrowStyle() === 'zone'"
                  [class.bg-gray-700]="!(activeTool() === 'arrow' && arrowStyle() === 'zone')"
                  title="Arrow pointing into a highlighted empty space / target zone">Target Zone</button>
          <button (click)="selectArrowStyle('block')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-amber-600]="activeTool() === 'arrow' && arrowStyle() === 'block'"
                  [class.bg-gray-700]="!(activeTool() === 'arrow' && arrowStyle() === 'block')"
                  title="Defensive block / screen line with perpendicular T-bar cap">Block ┬</button>
          <button (click)="selectArrowStyle('freehand')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-amber-600]="activeTool() === 'arrow' && arrowStyle() === 'freehand'"
                  [class.bg-gray-700]="!(activeTool() === 'arrow' && arrowStyle() === 'freehand')"
                  title="Freehand pencil sketch">Freehand</button>
        </div>

        <!-- Shapes, Text & Eraser -->
        <div class="inline-flex rounded shadow-md overflow-hidden" role="group" aria-label="Shapes and annotation tools">
          <button (click)="selectShapeTool('rect')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white transition-colors"
                  [class.bg-indigo-600]="activeTool() === 'shape' && shapeKind() === 'rect'"
                  [class.bg-gray-700]="!(activeTool() === 'shape' && shapeKind() === 'rect')"
                  title="Draw rectangular tactical zone">Rect Zone</button>
          <button (click)="selectShapeTool('ellipse')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-indigo-600]="activeTool() === 'shape' && shapeKind() === 'ellipse'"
                  [class.bg-gray-700]="!(activeTool() === 'shape' && shapeKind() === 'ellipse')"
                  title="Draw circular/elliptical pressing zone">Circle Zone</button>
          <button (click)="selectShapeTool('triangle')"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-indigo-600]="activeTool() === 'shape' && shapeKind() === 'triangle'"
                  [class.bg-gray-700]="!(activeTool() === 'shape' && shapeKind() === 'triangle')"
                  title="Draw triangular pressing trap / cover shadow">Triangle</button>
          <button (click)="selectTextTool()"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-indigo-600]="activeTool() === 'text'"
                  [class.bg-gray-700]="activeTool() !== 'text'"
                  title="Click on pitch to place a draggable text label">Text</button>
          <button (click)="selectEraserTool()"
                  class="px-2.5 py-1.5 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-rose-600]="activeTool() === 'eraser'"
                  [class.bg-gray-700]="activeTool() !== 'eraser'"
                  title="Click any arrow, zone, text, or equipment item to delete it">Eraser</button>
        </div>

        <button (click)="toggleDivisions()"
                class="px-3 py-1.5 text-xs text-white font-bold rounded shadow-md transition-colors"
                [class.bg-gray-700]="!showDivisions()"
                [class.bg-emerald-600]="showDivisions()">
          Pitch Divisions
        </button>

        <button (click)="store.undo()" [disabled]="!store.canUndo()"
                class="px-3 py-1.5 text-xs bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Undo</button>
        <button (click)="store.redo()" [disabled]="!store.canRedo()"
                class="px-3 py-1.5 text-xs bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Redo</button>
        <button (click)="store.clearArrows()" [disabled]="!store.hasArrows()"
                class="px-3 py-1.5 text-xs bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Clear Arrows</button>
        <button (click)="saveBoard()"
                class="px-3 py-1.5 text-xs bg-emerald-700 text-white font-bold rounded shadow-md">Save</button>
        <button (click)="loadBoard()" [disabled]="!hasSavedBoard()"
                class="px-3 py-1.5 text-xs bg-emerald-700 text-white font-bold rounded shadow-md disabled:opacity-40">Load</button>
        <button (click)="showCollections.set(!showCollections())"
                class="px-3 py-1.5 text-xs font-bold rounded shadow-md transition-colors"
                [class.bg-teal-600]="showCollections()"
                [class.bg-gray-700]="!showCollections()"
                title="Open multi-board Collections library and JSON import/export">
          Collections ({{ collections().length }})
        </button>
        <button (click)="shareSchemeLink()"
                class="px-3 py-1.5 text-xs bg-sky-700 hover:bg-sky-600 text-white font-bold rounded shadow-md"
                title="Copy a shareable link encoding the entire board and animation">Share Link</button>
        <button (click)="resetBoard()"
                class="px-3 py-1.5 text-xs bg-gray-700 text-white font-bold rounded shadow-md">Reset</button>
        @if (statusMessage()) {
          <span class="self-center text-xs text-amber-300 font-semibold">{{ statusMessage() }}</span>
        }
      </fieldset>

      <!-- Row 2: Formations, Team Colors, Pitch Views, Drawing Palette & Equipment Toggle -->
      <fieldset class="flex flex-wrap items-center gap-3 mb-2 px-3 py-2 rounded bg-gray-800/90 text-xs border-0 m-0 min-w-0" [disabled]="isPlaying() || isExporting()">
        <!-- Home Team Formation & Color -->
        <div class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 rounded-full border border-white/60" [style.background]="store.homeColor()"></span>
          <span class="font-bold text-gray-200">Home:</span>
          <select aria-label="Home formation"
                  class="bg-gray-700 text-white rounded px-2 py-1 font-semibold"
                  [value]="store.homeFormation()"
                  (change)="onFormationChange('home', $any($event.target).value)">
            @for (f of formations; track f) {
              <option [value]="f">{{ f }}</option>
            }
          </select>
          <input type="color" aria-label="Home team color"
                 class="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                 [value]="store.homeColor()"
                 (input)="onTeamColorChange('home', $any($event.target).value)" />
        </div>

        <!-- Away Team Formation & Color -->
        <div class="flex items-center gap-1.5">
          <span class="inline-block w-3 h-3 rounded-full border border-white/60" [style.background]="store.awayColor()"></span>
          <span class="font-bold text-gray-200">Away:</span>
          <select aria-label="Away formation"
                  class="bg-gray-700 text-white rounded px-2 py-1 font-semibold"
                  [value]="store.awayFormation()"
                  (change)="onFormationChange('away', $any($event.target).value)">
            @for (f of formations; track f) {
              <option [value]="f">{{ f }}</option>
            }
          </select>
          <input type="color" aria-label="Away team color"
                 class="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                 [value]="store.awayColor()"
                 (input)="onTeamColorChange('away', $any($event.target).value)" />
        </div>

        <span class="text-gray-600">|</span>

        <!-- Pitch View & Turf Toggles -->
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-gray-300">Pitch:</span>
          <select aria-label="Pitch view"
                  class="bg-gray-700 text-white rounded px-2 py-1 font-semibold"
                  [value]="pitchView()"
                  (change)="setPitchView($any($event.target).value)">
            <option value="full">Full Horizontal</option>
            <option value="half-left">Half Pitch (Left)</option>
            <option value="half-right">Half Pitch (Right)</option>
            <option value="vertical">Full Vertical</option>
          </select>
          <select aria-label="Board zoom"
                  class="bg-gray-700 text-white rounded px-2 py-1 font-semibold"
                  title="Board size"
                  [value]="boardZoom()"
                  (change)="setBoardZoom(+$any($event.target).value)">
            <option value="0.8">80%</option>
            <option value="0.9">90%</option>
            <option value="1">100%</option>
            <option value="1.15">115%</option>
            <option value="1.3">130%</option>
          </select>
          <label class="inline-flex items-center gap-1 cursor-pointer ml-1">
            <input type="checkbox" [checked]="showStripes()" (change)="toggleStripes()" />
            Stripes
          </label>
          <label class="inline-flex items-center gap-1 cursor-pointer ml-1">
            <input type="checkbox" [checked]="showMarkings()" (change)="toggleMarkings()" />
            Lines
          </label>
        </div>

        <span class="text-gray-600">|</span>

        <!-- Drawing Color & Thickness -->
        <div class="flex items-center gap-1.5">
          <span class="font-bold text-gray-300">Ink:</span>
          @for (c of drawingColors; track c.hex) {
            <button type="button" (click)="drawColor.set(c.hex)"
                    class="w-4 h-4 rounded-full border transition-transform"
                    [style.background]="c.hex"
                    [class.scale-125]="drawColor() === c.hex"
                    [class.border-white]="drawColor() === c.hex"
                    [class.border-gray-600]="drawColor() !== c.hex"
                    [title]="c.name"></button>
          }
          <select aria-label="Stroke thickness"
                  class="bg-gray-700 text-white rounded px-1.5 py-0.5 ml-1"
                  [value]="drawWidth()"
                  (change)="drawWidth.set(+$any($event.target).value)">
            <option [value]="2.5">Thin</option>
            <option [value]="4">Med</option>
            <option [value]="6.5">Thick</option>
          </select>
        </div>

        @if (activeTool() === 'text') {
          <div class="flex items-center gap-1.5">
            <input type="text" placeholder="Label text (then click pitch)..."
                   class="bg-gray-900 text-white px-2 py-1 rounded border border-indigo-500 w-44"
                   [value]="pendingText()"
                   (input)="pendingText.set($any($event.target).value)" />
            <select aria-label="Text size"
                    class="bg-gray-700 text-white rounded px-1.5 py-1"
                    [value]="textSize()"
                    (change)="textSize.set(+$any($event.target).value)">
              <option [value]="14">S</option>
              <option [value]="18">M</option>
              <option [value]="24">L</option>
            </select>
          </div>
        }

        <button type="button" (click)="showEquipmentTray.set(!showEquipmentTray())"
                class="ml-auto px-2.5 py-1 font-bold rounded transition-colors"
                [class.bg-amber-600]="showEquipmentTray()"
                [class.bg-gray-700]="!showEquipmentTray()">
          {{ showEquipmentTray() ? 'Hide Equipment & Bench' : '+ Equipment & Bench' }}
        </button>
      </fieldset>

      <!-- Collapsible Equipment & Squad Tray -->
      @if (showEquipmentTray()) {
        <div class="flex flex-wrap items-center gap-2 mb-2 px-3 py-2 rounded bg-gray-800/80 border border-gray-700 text-xs">
          <span class="font-bold text-amber-400">Add to Pitch:</span>
          <button type="button" (click)="spawnSquadToken('home')"
                  class="px-2 py-1 bg-red-700 hover:bg-red-600 rounded font-semibold">+ Home Player</button>
          <button type="button" (click)="spawnSquadToken('away')"
                  class="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded font-semibold">+ Away Player</button>
          <button type="button" (click)="spawnSquadToken('referee')"
                  class="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded font-semibold">+ Referee</button>
          <button type="button" (click)="spawnSquadToken('ball')"
                  class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded font-semibold">+ Ball</button>
          <span class="text-gray-600">|</span>
          @for (item of equipmentCatalog; track item.kind) {
            <button type="button" (click)="spawnEquipment(item.kind, item.defaultColor)"
                    class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded font-semibold">
              + {{ item.label }}
            </button>
          }
        </div>
      }

      <!-- Selected Token / Equipment Inspector Bar (shown when a player or equipment is clicked) -->
      @if (selectedEntity(); as sel) {
        <div class="flex flex-wrap items-center gap-3 mb-2 px-3 py-2 rounded bg-indigo-950/90 border border-indigo-500/60 text-xs">
          <span class="font-bold text-indigo-300">
            Selected: {{ sel.type === 'home' ? 'Home Player' : sel.type === 'away' ? 'Away Player' : sel.type === 'referee' ? 'Referee' : sel.equipmentKind || 'Ball' }}
          </span>

          @if (sel.type === 'home' || sel.type === 'away' || sel.type === 'referee') {
            <label class="flex items-center gap-1">
              Number:
              <input type="text" maxlength="3"
                     class="w-12 bg-gray-900 text-white px-1.5 py-0.5 rounded border border-gray-600 text-center font-bold"
                     [value]="sel.label ?? ''"
                     (input)="updateSelectedMeta({ label: $any($event.target).value })" />
            </label>
            <label class="flex items-center gap-1">
              Name / Role:
              <input type="text" maxlength="18" placeholder="e.g. Salah / CDM"
                     class="w-32 bg-gray-900 text-white px-2 py-0.5 rounded border border-gray-600"
                     [value]="sel.name ?? ''"
                     (input)="updateSelectedMeta({ name: $any($event.target).value })" />
            </label>
            <label class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox"
                     [checked]="!!sel.showVision"
                     (change)="updateSelectedMeta({ showVision: !sel.showVision, facing: sel.facing ?? (sel.type === 'away' ? 180 : 0) })" />
              Vision Cone
            </label>
            @if (sel.showVision) {
              <label class="flex items-center gap-1">
                Facing {{ sel.facing ?? 0 }}°
                <input type="range" min="0" max="355" step="5" class="w-24"
                       [value]="sel.facing ?? 0"
                       (input)="updateSelectedMeta({ facing: +$any($event.target).value })" />
              </label>
            }
          }

          @if (sel.type === 'equipment') {
            <button type="button"
                    (click)="updateSelectedMeta({ rotation: ((sel.rotation ?? 0) + 45) % 360 })"
                    class="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded font-semibold">
              Rotate 45° ({{ sel.rotation ?? 0 }}°)
            </button>
            <input type="color" aria-label="Equipment color"
                   class="w-6 h-5 rounded cursor-pointer bg-transparent border-0"
                   [value]="sel.color || '#f97316'"
                   (input)="updateSelectedMeta({ color: $any($event.target).value })" />
          }

          @if (sel.id !== 'ball') {
            <button type="button" (click)="deleteSelectedEntity()"
                    class="px-2 py-0.5 bg-rose-700 hover:bg-rose-600 rounded font-semibold">
              Remove from Pitch
            </button>
          }
          <button type="button" (click)="selectedEntityId.set(null)"
                  class="ml-auto px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded">Done</button>
        </div>
      }

      <!-- Collapsible Collections Library Modal/Drawer -->
      @if (showCollections()) {
        <div class="mb-3 p-3 rounded bg-gray-800 border border-teal-600/60 text-xs flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-teal-300 text-sm">Tactical Collections Library</span>
            <input type="text" placeholder="Scheme title (e.g. Arsenal High Press 4-3-3)..."
                   class="bg-gray-900 text-white px-2.5 py-1 rounded border border-gray-600 w-64"
                   [value]="collectionTitle()"
                   (input)="collectionTitle.set($any($event.target).value)" />
            <select aria-label="Scheme category"
                    class="bg-gray-700 text-white rounded px-2 py-1"
                    [value]="collectionCategory()"
                    (change)="collectionCategory.set($any($event.target).value)">
              <option value="Match Tactic">Match Tactic</option>
              <option value="Set Piece">Set Piece</option>
              <option value="Training Drill">Training Drill</option>
            </select>
            <button type="button" (click)="addCurrentToCollections()"
                    class="px-3 py-1 bg-teal-600 hover:bg-teal-500 font-bold rounded">
              + Save to Collection
            </button>
            <button type="button" (click)="exportJsonFile()"
                    class="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 font-semibold rounded">
              Export .JSON
            </button>
            <label class="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 font-semibold rounded cursor-pointer">
              Import .JSON
              <input type="file" accept=".json,application/json" class="hidden" (change)="importJsonFile($event)" />
            </label>
            <button type="button" (click)="showCollections.set(false)"
                    class="ml-auto px-2 py-1 bg-gray-700 rounded">Close</button>
          </div>
          @if (collections().length === 0) {
            <p class="text-gray-400">No schemes saved in your collection yet. Enter a title above and click "+ Save to Collection".</p>
          } @else {
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pt-1">
              @for (item of collections(); track item.id) {
                <div class="flex items-center justify-between gap-2 p-2 rounded bg-gray-900/90 border border-gray-700">
                  <div class="min-w-0">
                    <div class="font-bold text-white truncate">{{ item.title }}</div>
                    <div class="text-[11px] text-gray-400">{{ item.category }} • {{ item.frameCount }} frame(s)</div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" (click)="loadFromCollection(item)"
                            class="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded font-bold">Load</button>
                    <button type="button" (click)="removeFromCollection(item.id)"
                            class="px-2 py-1 bg-rose-800 hover:bg-rose-700 rounded">✕</button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- The Canvas Container -->
      <div class="bg-[#2e7d32] shadow-2xl overflow-hidden rounded-md touch-none select-none mx-auto w-full"
           [style.aspect-ratio]="containerAspect()"
           [style.max-width]="containerMaxWidth()"
           #canvasContainer></div>

      <!-- Timeline & Export Bar -->
      <div class="mt-3 p-3 rounded-md bg-gray-800 text-white flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <button (click)="isPlaying() ? stopPlayback() : play()"
                  [disabled]="isExporting() || (!isPlaying() && store.frameCount() < 2)"
                  class="px-4 py-1.5 font-bold rounded shadow-md disabled:opacity-40"
                  [class.bg-blue-600]="!isPlaying()"
                  [class.bg-red-600]="isPlaying()">
            {{ isPlaying() ? 'Stop' : 'Play' }}
          </button>

          <button (click)="playSingleStep()"
                  [disabled]="isPlaying() || isExporting() || store.frameCount() < 2"
                  class="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 rounded text-xs font-bold disabled:opacity-40"
                  title="Preview only the current step transition">
            Play Step
          </button>

          <fieldset class="flex flex-wrap items-center gap-1.5 border-0 p-0 m-0 min-w-0" [disabled]="isPlaying() || isExporting()">
            <button (click)="store.goToFrame(store.currentFrame() - 1)" [disabled]="store.currentFrame() === 0"
                    class="px-2.5 py-1.5 bg-gray-700 rounded disabled:opacity-40" aria-label="Previous frame">&lt;</button>
            @for (i of frameIndexes(); track i) {
              <button (click)="store.goToFrame(i)"
                      class="min-w-8 px-2.5 py-1.5 rounded font-bold text-xs"
                      [class.bg-emerald-600]="i === store.currentFrame()"
                      [class.bg-gray-700]="i !== store.currentFrame()">{{ i + 1 }}</button>
            }
            <button (click)="store.goToFrame(store.currentFrame() + 1)"
                    [disabled]="store.currentFrame() >= store.frameCount() - 1"
                    class="px-2.5 py-1.5 bg-gray-700 rounded disabled:opacity-40" aria-label="Next frame">&gt;</button>

            <button (click)="store.addFrame()" class="px-3 py-1.5 bg-blue-700 rounded text-xs font-bold"
                    title="New step with the same positions and no arrows">+ Frame</button>
            <button (click)="store.duplicateFrame()" class="px-3 py-1.5 bg-gray-700 rounded text-xs font-bold"
                    title="Copy this step including its arrows">Duplicate</button>
            <button (click)="deleteFrame()" [disabled]="store.frameCount() < 2"
                    class="px-3 py-1.5 bg-gray-700 rounded text-xs font-bold disabled:opacity-40">Delete</button>

            <span class="text-gray-600 mx-1">|</span>

            <button (click)="exportPng()"
                    class="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 rounded text-xs font-bold"
                    title="Download high-resolution PNG image of the current board">
              Export PNG
            </button>
            <button (click)="exportGif()" [disabled]="store.frameCount() < 2"
                    class="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-xs font-bold disabled:opacity-40"
                    title="Render the timeline into a looping animated GIF">
              {{ isExporting() && exportKind() === 'gif' ? 'GIF (' + exportProgress() + '%)' : 'Export GIF' }}
            </button>
            <button (click)="exportMp4()" [disabled]="store.frameCount() < 2"
                    class="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-xs font-bold disabled:opacity-40"
                    title="Render the timeline into a downloadable 720p MP4 video">
              {{ isExporting() && exportKind() === 'mp4' ? 'Exporting (' + exportProgress() + '%)' : 'Export MP4' }}
            </button>
          </fieldset>
        </div>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <label class="flex items-center gap-2 grow min-w-44">
            Scrub
            <input type="range" class="w-full" min="0" step="0.01"
                   [max]="store.frameCount() - 1" [value]="scrubPos()"
                   [disabled]="isPlaying() || isExporting() || store.frameCount() < 2"
                   (input)="onScrub($event)" (change)="onScrubEnd()" />
          </label>
          <label class="flex items-center gap-1.5">
            Step {{ (store.stepDurationMs() / 1000).toFixed(1) }}s
            <input type="range" min="300" max="3000" step="100" [value]="store.stepDurationMs()"
                   (input)="store.setStepDuration(+$any($event.target).value)" />
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" [checked]="loopPlayback()" (change)="loopPlayback.set(!loopPlayback())" />
            Loop
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" [checked]="showGhost()" (change)="showGhost.set(!showGhost())" />
            Ghost previous frame
          </label>
          <input type="text"
                 placeholder="Frame coaching note (e.g. Phase 1: High Press)..."
                 class="bg-gray-900 text-white px-2.5 py-1 rounded border border-gray-700 w-64"
                 [value]="store.note()"
                 (input)="store.updateFrameNote($any($event.target).value)" />
        </div>
      </div>
    </div>
  `,
})
export class PitchBoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  protected store = inject(BoardStore);

  protected readonly formations = FORMATION_NAMES;
  protected readonly drawingColors = DRAWING_COLORS;
  protected readonly equipmentCatalog = EQUIPMENT_CATALOG;

  // UI Signals
  activeTool = signal<ActiveToolMode>('move');
  isDrawingMode = computed(() => this.activeTool() !== 'move');
  arrowStyle = signal<ArrowStyle>('pass');
  shapeKind = signal<ShapeKind>('rect');
  drawColor = signal('#f1c40f');
  drawWidth = signal(4);
  pendingText = signal('Press Trigger');
  textSize = signal(18);

  pitchView = signal<PitchViewMode>('full');
  boardZoom = signal(0.9);
  showStripes = signal(true);
  showMarkings = signal(true);
  showDivisions = signal(false);
  showGhost = signal(true);
  loopPlayback = signal(false);
  showEquipmentTray = signal(false);
  showCollections = signal(false);

  /** Counter-rotation applied to upright elements (numbers, names, cones, text) when stage is rotated 90 deg in vertical view. */
  uprightRotation = computed(() => (this.pitchView() === 'vertical' ? -90 : 0));

  containerAspect = computed(() => {
    const v = this.pitchView();
    if (v === 'vertical') return `${FULL_VIEW_H} / ${FULL_VIEW_W}`;
    if (v === 'half-left' || v === 'half-right') return `${HALF_VIEW_W} / ${FULL_VIEW_H}`;
    return `${FULL_VIEW_W} / ${FULL_VIEW_H}`;
  });

  containerMaxWidth = computed(() => {
    const z = this.boardZoom();
    const v = this.pitchView();
    if (v === 'vertical') return `min(${Math.round(490 * z)}px, calc((100dvh - 210px) * 0.648 * ${z}))`;
    if (v === 'half-left' || v === 'half-right') return `min(${Math.round(550 * z)}px, calc((100dvh - 210px) * 0.779 * ${z}))`;
    return `min(${Math.round(920 * z)}px, calc((100dvh - 210px) * 1.541 * ${z}))`;
  });

  selectedEntityId = signal<string | null>(null);
  selectedEntity = computed(() => {
    const id = this.selectedEntityId();
    if (!id) return null;
    return this.store.entities().find((e) => e.id === id) ?? null;
  });

  collections = signal<SavedCollectionItem[]>(loadCollections());
  collectionTitle = signal('');
  collectionCategory = signal<SavedCollectionItem['category']>('Match Tactic');

  isPlaying = signal(false);
  isExporting = signal(false);
  exportKind = signal<'mp4' | 'gif'>('mp4');
  exportProgress = signal(0);
  private ffmpegCore?: any;
  scrubPos = signal(0);
  protected frameIndexes = computed(() => Array.from({ length: this.store.frameCount() }, (_, i) => i));
  hasSavedBoard = signal(localStorage.getItem(STORAGE_KEY) !== null);
  statusMessage = signal('');
  private statusTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      this.showGhost();
      this.store.homeColor();
      this.store.awayColor();
      if (this.isPlaying() || this.isExporting()) return;
      this.syncFromStore();
    });
  }

  private syncFromStore() {
    const entities = this.store.entities();
    const arrows = this.store.arrows();
    const shapes = this.store.shapes();
    const texts = this.store.texts();
    const note = this.store.note();
    const frames = this.store.frames();
    const current = this.store.currentFrame();
    const ghost = this.showGhost();
    if (!this.entityLayer) return;

    this.syncEntities(entities);
    this.renderShapes(shapes);
    this.renderArrows(arrows, !this.isPlaying() && !this.isExporting());
    this.renderTexts(texts, note);
    this.renderGoalScoredOverlay(entities);
    this.drawingLayer.opacity(1);
    this.renderGhost(ghost && current > 0 ? frames[current - 1].entities : null, entities);
    this.scrubPos.set(current);

    this.shapesLayer.batchDraw();
    this.entityLayer.batchDraw();
    this.drawingLayer.batchDraw();
    this.ghostLayer.batchDraw();
  }

  private renderShapes(shapes: TacticalShape[]) {
    this.shapesLayer.destroyChildren();
    shapes.forEach((s) => {
      const node = this.createShapeNode(s);
      node.on('mouseenter', () => {
        if (this.activeTool() === 'eraser') {
          this.setStageCursor(CURSORS.eraserHot);
        }
      });
      node.on('mouseleave', () => {
        this.setStageCursor(this.defaultToolCursor());
      });
      node.on('click tap', (e) => {
        if (this.activeTool() === 'eraser') {
          e.cancelBubble = true;
          this.ngZone.run(() => this.store.removeShape(s.id));
          this.setStageCursor(this.defaultToolCursor());
        }
      });
      this.shapesLayer.add(node);
    });
  }

  private createShapeNode(s: Pick<TacticalShape, 'kind' | 'x1' | 'y1' | 'x2' | 'y2' | 'color'>): Konva.Shape {
    const x = Math.min(s.x1, s.x2);
    const y = Math.min(s.y1, s.y2);
    const w = Math.abs(s.x2 - s.x1);
    const h = Math.abs(s.y2 - s.y1);
    const fill = this.hexWithAlpha(s.color, 0.2);
    const common = {
      fill,
      stroke: s.color,
      strokeWidth: 2.5,
      dash: [8, 5],
      listening: this.activeTool() === 'eraser',
    };

    if (s.kind === 'ellipse') {
      return new Konva.Ellipse({
        x: x + w / 2,
        y: y + h / 2,
        radiusX: Math.max(4, w / 2),
        radiusY: Math.max(4, h / 2),
        ...common,
      });
    }
    if (s.kind === 'triangle') {
      return new Konva.Line({
        points: [s.x1, s.y1, s.x2, s.y2, s.x1 * 2 - s.x2, s.y2],
        closed: true,
        ...common,
      });
    }
    return new Konva.Rect({
      x,
      y,
      width: w,
      height: h,
      cornerRadius: 4,
      ...common,
    });
  }

  private renderTexts(texts: TacticalText[], frameNote: string) {
    const uprightRot = this.uprightRotation();
    // Frame coaching note banner at top center of visible pitch if non-empty
    if (frameNote.trim()) {
      const bannerWidth = Math.min(580, Math.max(220, frameNote.length * 9.2 + 34));
      const isVert = this.pitchView() === 'vertical';
      const bx = isVert ? 26 : (this.BASE_WIDTH - bannerWidth) / 2;
      const by = isVert ? this.BASE_HEIGHT / 2 : 12;
      const noteGroup = new Konva.Group({
        x: bx,
        y: by,
        rotation: uprightRot,
        offsetX: isVert ? bannerWidth / 2 : 0,
        offsetY: isVert ? 14 : 0,
        listening: false,
      });
      noteGroup.add(
        new Konva.Rect({
          width: bannerWidth,
          height: 28,
          fill: 'rgba(17, 24, 39, 0.82)',
          stroke: 'rgba(241, 196, 15, 0.65)',
          strokeWidth: 1.5,
          cornerRadius: 6,
        }),
        new Konva.Text({
          width: bannerWidth,
          height: 28,
          text: frameNote,
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontStyle: 'bold',
          fill: '#fef08a',
          align: 'center',
          verticalAlign: 'middle',
        })
      );
      this.drawingLayer.add(noteGroup);
    }

    const canDrag = this.activeTool() === 'move' && !this.isPlaying() && !this.isExporting();
    texts.forEach((t) => {
      const textGroup = new Konva.Group({
        x: t.x,
        y: t.y,
        rotation: uprightRot,
        draggable: canDrag,
        listening: canDrag || this.activeTool() === 'eraser',
        dragBoundFunc: (pos) => this.clampStageDragPos(pos, 16),
      });
      const padX = 8;
      const padY = 4;
      const txt = new Konva.Text({
        text: t.text,
        fontSize: t.fontSize,
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        fill: t.color,
        padding: padY,
      });
      const w = txt.width() + padX * 2;
      const h = txt.height();
      txt.offsetX(w / 2 - padX);
      txt.offsetY(h / 2);

      textGroup.add(
        new Konva.Rect({
          x: -w / 2,
          y: -h / 2,
          width: w,
          height: h,
          fill: 'rgba(17, 24, 39, 0.78)',
          stroke: t.color,
          strokeWidth: 1.2,
          cornerRadius: 4,
        }),
        txt
      );

      textGroup.on('mouseenter', () => {
        if (this.activeTool() === 'eraser') {
          this.setStageCursor(CURSORS.eraserHot);
        } else if (canDrag) {
          this.setStageCursor('grab');
        }
      });
      textGroup.on('mouseleave', () => {
        this.setStageCursor(this.defaultToolCursor());
      });
      textGroup.on('dragstart', () => this.setStageCursor('grabbing'));
      textGroup.on('click tap', (e) => {
        if (this.activeTool() === 'eraser') {
          e.cancelBubble = true;
          this.ngZone.run(() => this.store.removeText(t.id));
          this.setStageCursor(this.defaultToolCursor());
        }
      });
      textGroup.on('dragend', () => {
        this.setStageCursor('grab');
        const p = textGroup.position();
        this.ngZone.run(() => this.store.updateTextPosition(t.id, Math.round(p.x), Math.round(p.y)));
      });
      this.drawingLayer.add(textGroup);
    });
  }

  /** Highlights the left or right protruding goal net and renders a "GOAL!" celebration badge when a ball enters the goal mouth. */
  private renderGoalScoredOverlay(entities: TacticalEntity[]) {
    const balls = entities.filter((e) => e.type === 'ball');
    const uprightRot = this.uprightRotation();
    const checkGoal = (side: 'left' | 'right') => {
      const scored = balls.some((b) =>
        side === 'left'
          ? b.x <= 12 && b.y >= GOAL_TOP - 4 && b.y <= GOAL_TOP + GOAL_WIDTH + 4
          : b.x >= this.BASE_WIDTH - 12 && b.y >= GOAL_TOP - 4 && b.y <= GOAL_TOP + GOAL_WIDTH + 4
      );
      if (!scored) return;

      const gx = side === 'left' ? -GOAL_DEPTH : this.BASE_WIDTH;
      this.drawingLayer.add(
        new Konva.Rect({
          x: gx,
          y: GOAL_TOP,
          width: GOAL_DEPTH,
          height: GOAL_WIDTH,
          fill: 'rgba(250, 204, 21, 0.42)',
          stroke: '#facc15',
          strokeWidth: 3,
          listening: false,
        })
      );

      const badgeX = side === 'left' ? 38 : this.BASE_WIDTH - 38;
      const badgeY = GOAL_TOP - 18;
      const badge = new Konva.Group({
        x: badgeX,
        y: badgeY,
        rotation: uprightRot,
        listening: false,
      });
      badge.add(
        new Konva.Rect({
          x: -36,
          y: -12,
          width: 72,
          height: 24,
          cornerRadius: 12,
          fill: '#f59e0b',
          stroke: '#111827',
          strokeWidth: 1.5,
        }),
        new Konva.Text({
          x: -36,
          y: -12,
          width: 72,
          height: 24,
          text: '⚽ GOAL!',
          fontSize: 12,
          fontStyle: 'bold',
          fontFamily: 'sans-serif',
          fill: '#111827',
          align: 'center',
          verticalAlign: 'middle',
        })
      );
      this.drawingLayer.add(badge);
    };

    checkGoal('left');
    checkGoal('right');
  }

  private renderArrows(arrows: TacticalArrow[], showHandles = false) {
    this.drawingLayer.destroyChildren();
    const isEraser = this.activeTool() === 'eraser';
    arrows.forEach((a) => {
      const arrowGroup = this.createArrow(a, isEraser);
      if (isEraser) {
        arrowGroup.on('mouseenter', () => this.setStageCursor(CURSORS.eraserHot));
        arrowGroup.on('mouseleave', () => this.setStageCursor(this.defaultToolCursor()));
        arrowGroup.on('click tap', (e) => {
          e.cancelBubble = true;
          this.ngZone.run(() => this.store.removeArrow(a.id));
          this.setStageCursor(this.defaultToolCursor());
        });
      }
      this.drawingLayer.add(arrowGroup);

      if (showHandles && !isEraser && a.style !== 'freehand') {
        const [x1, y1, x2, y2] = a.points;
        const [cx, cy] = a.controlPoint ?? [(x1 + x2) / 2, (y1 + y2) / 2];
        const handle = new Konva.Circle({
          name: 'curve-handle',
          x: cx,
          y: cy,
          radius: 6,
          fill: '#ffffff',
          stroke: a.color ?? '#f1c40f',
          strokeWidth: 2,
          opacity: 0.85,
          draggable: true,
          dragBoundFunc: (pos) => this.clampStageDragPos(pos, 6),
        });
        handle.on('mouseenter', () => this.setStageCursor('grab'));
        handle.on('mouseleave', () => this.setStageCursor(this.defaultToolCursor()));
        handle.on('dragstart', () => this.setStageCursor('grabbing'));
        handle.on('dragmove', () => {
          const p = handle.position();
          this.updateArrowGroup(arrowGroup, a.points, a.style ?? 'pass', [p.x, p.y]);
        });
        handle.on('dragend', () => {
          this.setStageCursor('grab');
          const p = handle.position();
          this.ngZone.run(() =>
            this.store.updateArrowControl(a.id, [Math.round(p.x), Math.round(p.y)])
          );
        });
        this.drawingLayer.add(handle);
      }
    });
  }

  /** Faded tokens and dashed trails showing where each piece stood in the previous frame. */
  private renderGhost(previous: TacticalEntity[] | null, current: TacticalEntity[]) {
    this.ghostLayer.destroyChildren();
    if (!previous) return;

    previous.forEach((p) => {
      const now = current.find((e) => e.id === p.id);
      if (!now || Math.hypot(now.x - p.x, now.y - p.y) < 4) return;

      const isBall = p.type === 'ball';
      const color =
        p.color ??
        (p.type === 'home'
          ? this.store.homeColor()
          : p.type === 'away'
            ? this.store.awayColor()
            : '#ffffff');
      this.ghostLayer.add(
        new Konva.Arrow({
          points: [p.x, p.y, now.x, now.y],
          stroke: 'rgba(255, 255, 255, 0.55)',
          fill: 'rgba(255, 255, 255, 0.55)',
          strokeWidth: 2,
          dash: [8, 6],
          pointerLength: 8,
          pointerWidth: 8,
          listening: false,
        })
      );
      this.ghostLayer.add(
        new Konva.Circle({
          x: p.x,
          y: p.y,
          radius: isBall ? 13 : 15,
          fill: color,
          opacity: 0.3,
          stroke: '#ffffff',
          strokeWidth: 1,
          dash: [4, 3],
          listening: false,
        })
      );
    });
  }

  private readonly ZONE_RADIUS = 28;

  private createArrow(
    arrow: Pick<TacticalArrow, 'points' | 'style' | 'controlPoint' | 'color' | 'strokeWidth' | 'pathPoints'>,
    interactive = false
  ): Konva.Group {
    const style = arrow.style ?? 'pass';
    const color = arrow.color ?? '#f1c40f';
    const strokeWidth = arrow.strokeWidth ?? 4;
    const group = new Konva.Group({ listening: interactive });

    if (style === 'zone') {
      const [, , x2, y2] = arrow.points;
      group.add(
        new Konva.Circle({
          name: 'zone-outer',
          x: x2,
          y: y2,
          radius: this.ZONE_RADIUS,
          fill: this.hexWithAlpha(color, 0.2),
          stroke: color,
          strokeWidth: 2.5,
          dash: [8, 5],
          listening: interactive,
        })
      );
      group.add(
        new Konva.Circle({
          name: 'zone-inner',
          x: x2,
          y: y2,
          radius: 5,
          fill: this.hexWithAlpha(color, 0.55),
          listening: false,
        })
      );
    }

    const pathPoints =
      style === 'freehand' && arrow.pathPoints && arrow.pathPoints.length >= 4
        ? arrow.pathPoints
        : this.computeArrowPath(arrow.points, style, arrow.controlPoint);

    if (style === 'block') {
      group.add(
        new Konva.Line({
          name: 'arrow-line',
          points: pathPoints,
          stroke: color,
          strokeWidth,
          hitStrokeWidth: 18,
          lineCap: 'round',
          lineJoin: 'round',
          listening: interactive,
        })
      );
      const tbarPts = this.computeTBarPoints(pathPoints);
      group.add(
        new Konva.Line({
          name: 'block-tbar',
          points: tbarPts,
          stroke: color,
          strokeWidth: strokeWidth + 1,
          lineCap: 'round',
          listening: interactive,
        })
      );
      return group;
    }

    group.add(
      new Konva.Arrow({
        name: 'arrow-line',
        points: pathPoints,
        pointerLength: 15,
        pointerWidth: 15,
        fill: color,
        stroke: color,
        strokeWidth,
        hitStrokeWidth: 18,
        dash: style === 'run' || style === 'zone' ? [12, 8] : undefined,
        tension: style === 'dribble' || style === 'freehand' ? 0.35 : 0,
        lineCap: 'round',
        lineJoin: 'round',
        listening: interactive,
      })
    );

    return group;
  }

  private computeTBarPoints(pathPoints: number[]): [number, number, number, number] {
    const n = pathPoints.length;
    const x2 = pathPoints[n - 2] ?? 0;
    const y2 = pathPoints[n - 1] ?? 0;
    const x1 = pathPoints[Math.max(0, n - 4)] ?? x2 - 1;
    const y1 = pathPoints[Math.max(1, n - 3)] ?? y2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const half = 14;
    return [x2 - nx * half, y2 - ny * half, x2 + nx * half, y2 + ny * half];
  }

  private updateArrowGroup(
    group: Konva.Group,
    points: [number, number, number, number],
    style: ArrowStyle,
    controlPoint?: [number, number],
    freehandPts?: number[]
  ) {
    const pathPts =
      style === 'freehand' && freehandPts && freehandPts.length >= 4
        ? freehandPts
        : this.computeArrowPath(points, style, controlPoint);
    const line = group.findOne<Konva.Line>('.arrow-line');
    if (line) {
      line.points(pathPts);
    }
    if (style === 'block') {
      const tbar = group.findOne<Konva.Line>('.block-tbar');
      if (tbar) tbar.points(this.computeTBarPoints(pathPts));
    }
    if (style === 'zone') {
      const [, , x2, y2] = points;
      group.findOne('.zone-outer')?.position({ x: x2, y: y2 });
      group.findOne('.zone-inner')?.position({ x: x2, y: y2 });
    }
  }

  /** Computes sampled points along a straight/curved line, adding sine waves for dribbles. */
  private computeArrowPath(
    points: [number, number, number, number],
    style: ArrowStyle,
    controlPoint?: [number, number]
  ): number[] {
    const [x1, y1, rawX2, rawY2] = points;
    const rawDist = Math.hypot(rawX2 - x1, rawY2 - y1);
    if (rawDist < 2) return [x1, y1, rawX2, rawY2];

    const mx = (x1 + rawX2) / 2;
    const my = (y1 + rawY2) / 2;
    const [cx, cy] = controlPoint ?? [mx, my];
    const isCurved = Math.hypot(cx - mx, cy - my) > 1.5;

    const qx = 2 * cx - 0.5 * (x1 + rawX2);
    const qy = 2 * cy - 0.5 * (y1 + rawY2);

    const endT =
      style === 'zone' && rawDist > this.ZONE_RADIUS + 12
        ? Math.max(0.25, 1 - (this.ZONE_RADIUS - 2) / rawDist)
        : 1;

    const pointAt = (t: number): [number, number] => {
      const s = t * endT;
      if (!isCurved) return [x1 + (rawX2 - x1) * s, y1 + (rawY2 - y1) * s];
      const u = 1 - s;
      return [
        u * u * x1 + 2 * u * s * qx + s * s * rawX2,
        u * u * y1 + 2 * u * s * qy + s * s * rawY2,
      ];
    };

    const tangentAt = (t: number): [number, number] => {
      const s = t * endT;
      const dx = isCurved ? 2 * (1 - s) * (qx - x1) + 2 * s * (rawX2 - qx) : rawX2 - x1;
      const dy = isCurved ? 2 * (1 - s) * (qy - y1) + 2 * s * (rawY2 - qy) : rawY2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    };

    if (style === 'dribble') {
      const waveLen = 20;
      const amp = 5.5;
      const cycles = Math.max(2, Math.round(rawDist / waveLen));
      const steps = cycles * 6;
      const out: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const [bx, by] = pointAt(t);
        const fade = t > 0.85 ? Math.max(0, (1 - t) / 0.15) : Math.min(1, t / 0.08);
        const offset = Math.sin(t * cycles * Math.PI * 2) * amp * fade;
        const [tx, ty] = tangentAt(t);
        out.push(bx - ty * offset, by + tx * offset);
      }
      return out;
    }

    if (!isCurved) {
      const [ex, ey] = pointAt(1);
      return [x1, y1, ex, ey];
    }

    const steps = 20;
    const out: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const [bx, by] = pointAt(i / steps);
      out.push(bx, by);
    }
    return out;
  }

  private hexWithAlpha(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(241, 196, 15, ${alpha})`;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (this.isPlaying() || this.isExporting()) return;

    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
      if (event.key === 'ArrowLeft') {
        this.store.goToFrame(this.store.currentFrame() - 1);
        return;
      }
      if (event.key === 'ArrowRight') {
        this.store.goToFrame(this.store.currentFrame() + 1);
        return;
      }
      if (event.key === 'Escape') {
        this.activeTool.set('move');
        this.selectedEntityId.set(null);
        this.updateDraggable();
        this.syncFromStore();
        return;
      }
    }

    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.store.undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.store.redo();
    }
  }

  onFormationChange(team: 'home' | 'away', formation: FormationName) {
    this.store.applyFormation(team, formation);
    this.showStatus(`${team === 'home' ? 'Home' : 'Away'} formation set to ${formation}`);
  }

  onTeamColorChange(team: 'home' | 'away', color: string) {
    this.store.setTeamColor(team, color);
    this.syncFromStore();
  }

  setPitchView(view: PitchViewMode) {
    this.pitchView.set(view);
    setTimeout(() => {
      this.applyStageViewport();
      this.drawDivisions();
      this.syncFromStore();
    }, 0);
  }

  setBoardZoom(zoom: number) {
    this.boardZoom.set(zoom);
    setTimeout(() => this.applyStageViewport(), 0);
  }

  toggleStripes() {
    this.showStripes.set(!this.showStripes());
    this.drawPitch();
    this.pitchLayer.batchDraw();
  }

  toggleMarkings() {
    this.showMarkings.set(!this.showMarkings());
    this.drawPitch();
    this.pitchLayer.batchDraw();
  }

  spawnSquadToken(type: 'home' | 'away' | 'referee' | 'ball') {
    const existing = this.store.entities().filter((e) => e.type === type);
    const nextNum = type === 'home' || type === 'away' ? String(existing.length + 1) : type === 'referee' ? 'R' : undefined;
    const id = this.store.addEntity({
      type,
      x: 525 + (Math.random() * 60 - 30),
      y: 340 + (Math.random() * 60 - 30),
      ...(nextNum ? { label: nextNum } : {}),
    });
    this.activeTool.set('move');
    this.selectedEntityId.set(id);
    this.updateDraggable();
    this.showStatus(`Added ${type} token`);
  }

  spawnEquipment(kind: EquipmentKind, defaultColor: string) {
    const id = this.store.addEntity({
      type: 'equipment',
      equipmentKind: kind,
      color: defaultColor,
      rotation: 0,
      x: 525 + Math.round(Math.random() * 80 - 40),
      y: 340 + Math.round(Math.random() * 80 - 40),
    });
    this.activeTool.set('move');
    this.selectedEntityId.set(id);
    this.updateDraggable();
    this.showStatus(`Added ${kind}`);
  }

  updateSelectedMeta(patch: Partial<TacticalEntity>) {
    const id = this.selectedEntityId();
    if (!id) return;
    this.store.updateEntityMeta(id, patch);
  }

  deleteSelectedEntity() {
    const id = this.selectedEntityId();
    if (!id || id === 'ball') return;
    this.store.removeEntity(id);
    this.selectedEntityId.set(null);
    this.showStatus('Removed from pitch');
  }

  // ---- Collections & Share Link ----
  addCurrentToCollections() {
    const updated = saveToCollections(
      this.collectionTitle(),
      this.collectionCategory(),
      this.store.exportBoard()
    );
    this.collections.set(updated);
    this.collectionTitle.set('');
    this.showStatus('Saved scheme to Collections');
  }

  loadFromCollection(item: SavedCollectionItem) {
    if (this.store.importBoard(item.data)) {
      this.syncFromStore();
      this.showStatus(`Loaded "${item.title}"`);
    }
  }

  removeFromCollection(id: string) {
    this.collections.set(deleteFromCollections(id));
  }

  exportJsonFile() {
    const data = JSON.stringify(this.store.exportBoard(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    this.triggerDownload(blob, 'tactical-board-scheme.json');
    this.showStatus('Exported tactical-board-scheme.json');
  }

  importJsonFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (this.store.importBoard(parsed)) {
          this.syncFromStore();
          this.showStatus(`Imported ${file.name}`);
        } else {
          this.showStatus('Invalid scheme file');
        }
      } catch {
        this.showStatus('Failed to parse JSON file');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  shareSchemeLink() {
    try {
      const hash = encodeSchemeHash(this.store.exportBoard());
      const url = `${window.location.origin}${window.location.pathname}${hash}`;
      window.history.replaceState(null, '', hash);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      this.showStatus('Shareable link copied & updated in URL');
    } catch {
      this.showStatus('Could not generate share link');
    }
  }

  resetBoard() {
    this.store.reset();
    this.selectedEntityId.set(null);
    this.showStatus('Board reset (Ctrl+Z to undo)');
  }

  saveBoard() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store.exportBoard()));
      this.hasSavedBoard.set(true);
      this.showStatus('Board saved');
    } catch {
      this.showStatus('Could not save (storage unavailable)');
    }
  }

  loadBoard() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);

      if (!this.store.importBoard(data)) {
        this.showStatus('Saved board is corrupted');
        return;
      }
      this.syncFromStore();
      this.showStatus('Board loaded');
    } catch {
      this.showStatus('Saved board is corrupted');
    }
  }

  deleteFrame() {
    if (this.store.frameCount() < 2) return;
    if (confirm(`Delete frame ${this.store.currentFrame() + 1}?`)) this.store.deleteFrame();
  }

  // ---- Timeline playback ----
  private activeTweens: Konva.Tween[] = [];
  private playbackTarget = 0;
  private singleStepOnly = false;

  play() {
    if (this.isPlaying()) return;
    const last = this.store.frameCount() - 1;
    if (last < 1) return;

    this.singleStepOnly = false;
    if (this.store.currentFrame() >= last) this.store.goToFrame(0);
    this.syncFromStore();
    this.playbackTarget = this.store.currentFrame();

    this.isPlaying.set(true);
    this.updateDraggable();
    this.ngZone.runOutsideAngular(() => this.playStep(this.playbackTarget));
  }

  playSingleStep() {
    if (this.isPlaying()) return;
    const last = this.store.frameCount() - 1;
    if (last < 1) return;

    this.singleStepOnly = true;
    const start = this.store.currentFrame() >= last ? 0 : this.store.currentFrame();
    if (start !== this.store.currentFrame()) this.store.goToFrame(start);
    this.syncFromStore();
    this.playbackTarget = start;

    this.isPlaying.set(true);
    this.updateDraggable();
    this.ngZone.runOutsideAngular(() => this.playStep(start));
  }

  stopPlayback() {
    this.activeTweens.forEach((t) => {
      t.pause();
      t.destroy();
    });
    this.activeTweens = [];
    this.drawingLayer.opacity(1);

    this.ngZone.run(() => {
      this.store.goToFrame(this.playbackTarget);
      this.isPlaying.set(false);
      this.updateDraggable();
    });
    this.syncFromStore();
  }

  /** Animates one transition (from -> from + 1): pieces glide, the next frame's arrows fade in. */
  private playStep(from: number) {
    const frames = this.store.frames();
    const to = from + 1;
    if (to >= frames.length) {
      if (this.loopPlayback() && !this.singleStepOnly && frames.length >= 2) {
        this.ngZone.run(() => this.store.goToFrame(0));
        this.syncFromStore();
        this.playbackTarget = 0;
        this.playStep(0);
        return;
      }
      this.stopPlayback();
      return;
    }
    this.playbackTarget = to;
    this.ngZone.run(() => this.scrubPos.set(to));

    const seconds = this.store.stepDurationMs() / 1000;
    this.ghostLayer.destroyChildren();
    this.ghostLayer.batchDraw();
    this.renderShapes(frames[to].shapes ?? []);
    this.shapesLayer.batchDraw();
    const stepArrows = frames[to].arrows.length > 0 ? frames[to].arrows : frames[from].arrows;
    this.renderArrows(stepArrows);
    this.renderTexts(frames[to].texts ?? [], frames[to].note ?? '');
    this.drawingLayer.opacity(frames[to].arrows.length > 0 ? 0 : 1);

    const tweens: Konva.Tween[] = [];
    frames[to].entities.forEach((e) => {
      const node = this.entityLayer.findOne('#' + e.id);
      if (!node || (node.x() === e.x && node.y() === e.y)) return;
      tweens.push(
        new Konva.Tween({ node, duration: seconds, x: e.x, y: e.y, easing: Konva.Easings.EaseInOut })
      );
    });
    tweens.push(
      new Konva.Tween({
        node: this.drawingLayer,
        duration: seconds,
        opacity: 1,
        easing: Konva.Easings.EaseInOut,
        onFinish: () => {
          if (this.singleStepOnly) {
            this.stopPlayback();
          } else {
            this.playStep(to);
          }
        },
      })
    );

    this.activeTweens = tweens;
    tweens.forEach((t) => t.play());
  }

  private defaultToolCursor(): string {
    if (this.isPlaying() || this.isExporting()) return 'default';
    const tool = this.activeTool();
    if (tool === 'eraser') return CURSORS.eraser;
    if (tool === 'arrow') return this.arrowStyle() === 'freehand' ? CURSORS.pencil : 'crosshair';
    if (tool === 'shape') return 'crosshair';
    if (tool === 'text') return 'text';
    return 'default';
  }

  private setStageCursor(cursor: string) {
    if (!this.stage) return;
    this.stage.container().style.cursor = cursor;
  }

  private updateDraggable() {
    const isMove = this.activeTool() === 'move' && !this.isPlaying() && !this.isExporting();
    const isEraser = this.activeTool() === 'eraser' && !this.isPlaying() && !this.isExporting();
    if (this.entityLayer) {
      this.entityLayer.listening(isMove || isEraser);
      this.entityLayer.getChildren().forEach((group) => group.draggable(isMove));
    }
    this.setStageCursor(this.defaultToolCursor());
  }

  toggleDrawingMode() {
    if (this.isDrawingMode()) {
      this.activeTool.set('move');
    } else {
      this.activeTool.set('arrow');
    }
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
  }

  selectArrowStyle(style: ArrowStyle) {
    this.arrowStyle.set(style);
    this.activeTool.set('arrow');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
  }

  selectShapeTool(kind: ShapeKind) {
    this.shapeKind.set(kind);
    this.activeTool.set('shape');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
  }

  selectTextTool() {
    this.activeTool.set('text');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
    this.showStatus('Click anywhere on the pitch to place text');
  }

  selectEraserTool() {
    this.activeTool.set(this.activeTool() === 'eraser' ? 'move' : 'eraser');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
    if (this.activeTool() === 'eraser') {
      this.showStatus('Eraser active: click any arrow, zone, text, or equipment to delete it');
    }
  }

  // ---- Export PNG, GIF & MP4 ----
  exportPng() {
    if (!this.stage) return;
    this.renderArrows(this.store.arrows(), false);
    this.renderTexts(this.store.texts(), this.store.note());
    this.stage.draw();
    const scale = this.stage.scaleX() || 1;
    const dataUrl = this.stage.toDataURL({
      pixelRatio: 2 / scale,
      mimeType: 'image/png',
    });
    this.syncFromStore();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'tactical-board.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.showStatus('PNG exported (tactical-board.png)');
  }

  async exportGif() {
    await this.runVideoExport('gif');
  }

  async exportMp4() {
    await this.runVideoExport('mp4');
  }

  private async runVideoExport(kind: 'mp4' | 'gif') {
    if (this.isExporting() || this.isPlaying() || this.store.frameCount() < 2) return;
    this.isExporting.set(true);
    this.exportKind.set(kind);
    this.exportProgress.set(0);
    this.updateDraggable();
    this.showStatus('Loading FFmpeg.wasm...');

    const savedView = this.pitchView();
    if (savedView !== 'full') {
      this.pitchView.set('full');
      this.applyStageViewport();
    }

    const writtenFiles: string[] = [];
    try {
      if (!this.ffmpegCore) {
        // @ts-ignore - @ffmpeg/core does not ship .d.ts files
        const mod: any = await import('@ffmpeg/core');
        const createFFmpegCore = mod.default ?? mod;
        const wasmUrl = new URL('@ffmpeg/core/wasm', import.meta.url).href;
        const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
        this.ffmpegCore = await createFFmpegCore({ wasmBinary });
      }
      const core = this.ffmpegCore;

      const frames = this.store.frames();
      const fps = kind === 'gif' ? 15 : 30;
      const framesPerStep = Math.max(6, Math.round((this.store.stepDurationMs() / 1000) * fps));
      const holdStart = Math.round(fps * 0.4);
      const holdEnd = Math.round(fps * 0.6);
      const totalTransitions = frames.length - 1;
      const totalVideoFrames = holdStart + totalTransitions * framesPerStep + holdEnd;

      this.ghostLayer.destroyChildren();
      this.ghostLayer.batchDraw();

      const capturePng = (idx: number) => {
        this.stage.draw();
        const scale = this.stage.scaleX() || 1;
        const dataUrl = this.stage.toDataURL({
          pixelRatio: 1 / scale,
          mimeType: 'image/png',
        });
        const base64 = dataUrl.split(',')[1];
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
        const name = `f_${String(idx).padStart(4, '0')}.png`;
        core.FS.writeFile(name, bytes);
        writtenFiles.push(name);
      };

      let frameIdx = 0;

      // 1. Render initial keyframe hold
      this.syncEntities(frames[0].entities);
      this.renderShapes(frames[0].shapes ?? []);
      this.renderArrows(frames[0].arrows, false);
      this.renderTexts(frames[0].texts ?? [], frames[0].note ?? '');
      this.drawingLayer.opacity(1);

      for (let h = 0; h < holdStart; h++) {
        capturePng(frameIdx++);
      }
      this.exportProgress.set(Math.round((frameIdx / totalVideoFrames) * 60));
      this.showStatus('Rendering tactical animation frames...');
      await new Promise((r) => setTimeout(r, 0));

      // 2. Render interpolated transition steps
      for (let step = 0; step < totalTransitions; step++) {
        const fromFrame = frames[step];
        const toFrame = frames[step + 1];
        const nextMap = new Map(toFrame.entities.map((e) => [e.id, e]));
        const hasFromArrows = fromFrame.arrows.length > 0;
        const hasToArrows = toFrame.arrows.length > 0;
        this.renderShapes(toFrame.shapes ?? fromFrame.shapes ?? []);

        for (let f = 1; f <= framesPerStep; f++) {
          const linear = f / framesPerStep;
          const progress = Konva.Easings.EaseInOut(linear, 0, 1, 1);
          fromFrame.entities.forEach((a) => {
            const b = nextMap.get(a.id);
            const node = this.entityLayer.findOne('#' + a.id);
            if (b && node) {
              node.position({ x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress });
            }
          });
          if (hasFromArrows && hasToArrows) {
            if (linear < 0.5) {
              this.renderArrows(fromFrame.arrows, false);
              this.renderTexts(fromFrame.texts ?? [], fromFrame.note ?? '');
              this.drawingLayer.opacity(1 - linear * 0.6);
            } else {
              this.renderArrows(toFrame.arrows, false);
              this.renderTexts(toFrame.texts ?? [], toFrame.note ?? '');
              this.drawingLayer.opacity(0.4 + (linear - 0.5) * 1.2);
            }
          } else if (hasToArrows) {
            this.renderArrows(toFrame.arrows, false);
            this.renderTexts(toFrame.texts ?? [], toFrame.note ?? '');
            this.drawingLayer.opacity(progress);
          } else {
            this.renderArrows(fromFrame.arrows, false);
            this.renderTexts(fromFrame.texts ?? [], fromFrame.note ?? '');
            this.drawingLayer.opacity(1);
          }

          capturePng(frameIdx++);
          if (f % 5 === 0) {
            this.exportProgress.set(Math.round((frameIdx / totalVideoFrames) * 60));
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }

      // 3. Hold final frame
      this.drawingLayer.opacity(1);
      for (let h = 0; h < holdEnd; h++) {
        capturePng(frameIdx++);
      }

      // 4. Encode MP4 or GIF in FFmpeg.wasm
      this.showStatus(kind === 'gif' ? 'Encoding animated GIF...' : 'Encoding MP4 video...');
      this.exportProgress.set(65);
      await new Promise((r) => setTimeout(r, 20));

      core.setProgress(({ progress }: { progress: number }) => {
        if (Number.isFinite(progress)) {
          this.ngZone.run(() =>
            this.exportProgress.set(Math.min(99, 65 + Math.round(Math.max(0, Math.min(1, progress)) * 34)))
          );
        }
      });

      const runExec = (args: string[]) => {
        core.setTimeout(-1);
        core.exec(...args);
        const ret = core.ret;
        core.reset();
        return ret;
      };

      const outName = kind === 'gif' ? 'tactical-board.gif' : 'tactical-board.mp4';
      try {
        core.FS.unlink(outName);
      } catch {}

      if (kind === 'gif') {
        runExec([
          '-framerate',
          String(fps),
          '-i',
          'f_%04d.png',
          '-vf',
          `fps=${fps},scale=840:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
          '-loop',
          '0',
          outName,
        ]);
      } else {
        const durationSec = (frameIdx / fps).toFixed(3);
        const vf =
          'scale=1280:720:force_original_aspect_ratio=decrease:flags=lanczos,' +
          'pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#111827,' +
          'setsar=1,format=yuv420p';

        const ret = runExec([
          '-framerate',
          String(fps),
          '-i',
          'f_%04d.png',
          '-f',
          'lavfi',
          '-t',
          durationSec,
          '-i',
          'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-vf',
          vf,
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-profile:v',
          'main',
          '-level',
          '3.1',
          '-bf',
          '0',
          '-crf',
          '20',
          '-pix_fmt',
          'yuv420p',
          '-colorspace',
          'bt709',
          '-color_primaries',
          'bt709',
          '-color_trc',
          'bt709',
          '-color_range',
          'tv',
          '-c:a',
          'aac',
          '-b:a',
          '96k',
          '-shortest',
          '-brand',
          'mp42',
          '-movflags',
          '+faststart',
          outName,
        ]);
        if (ret !== 0) {
          try {
            core.FS.unlink(outName);
          } catch {}
          runExec([
            '-framerate',
            String(fps),
            '-i',
            'f_%04d.png',
            '-vf',
            vf,
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-profile:v',
            'baseline',
            '-level',
            '3.0',
            '-pix_fmt',
            'yuv420p',
            '-brand',
            'mp42',
            '-movflags',
            '+faststart',
            outName,
          ]);
        }
      }

      const data: Uint8Array = core.FS.readFile(outName, { encoding: 'binary' });
      writtenFiles.push(outName);
      if (!data || data.byteLength < 256) {
        throw new Error(`Encoded ${kind.toUpperCase()} is empty (${data?.byteLength ?? 0} bytes)`);
      }
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      const blob = new Blob([copy.buffer], { type: kind === 'gif' ? 'image/gif' : 'video/mp4' });
      this.triggerDownload(blob, outName);

      this.exportProgress.set(100);
      this.showStatus(`${kind.toUpperCase()} exported (${outName})`);
    } catch (err) {
      console.error(`${kind.toUpperCase()} export failed:`, err);
      this.showStatus(`${kind.toUpperCase()} export failed`);
    } finally {
      if (this.ffmpegCore) {
        for (const f of writtenFiles) {
          try {
            this.ffmpegCore.FS.unlink(f);
          } catch {}
        }
      }
      if (savedView !== 'full') {
        this.pitchView.set(savedView);
        this.applyStageViewport();
      }
      this.isExporting.set(false);
      this.updateDraggable();
      this.syncFromStore();
    }
  }

  private triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---- Scrubber: preview positions between two frames without changing the store ----
  onScrub(event: Event) {
    const t = +(event.target as HTMLInputElement).value;
    this.scrubPos.set(t);
    this.previewAt(t);
  }

  onScrubEnd() {
    this.store.goToFrame(Math.round(this.scrubPos()));
    this.syncFromStore();
  }

  private previewAt(t: number) {
    const frames = this.store.frames();
    if (frames.length < 2 || !this.entityLayer) return;

    const i = Math.min(Math.floor(t), frames.length - 2);
    const progress = Konva.Easings.EaseInOut(t - i, 0, 1, 1);
    const next = new Map(frames[i + 1].entities.map((e) => [e.id, e]));

    frames[i].entities.forEach((a) => {
      const b = next.get(a.id);
      const node = this.entityLayer.findOne('#' + a.id);
      if (!b || !node) return;
      node.position({ x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress });
    });

    const activeIdx = t - i < 0.5 ? i : i + 1;
    const primaryArrows = frames[activeIdx].arrows;
    const fallbackArrows = frames[t - i < 0.5 ? i + 1 : i].arrows;
    this.renderShapes(frames[activeIdx].shapes ?? []);
    this.renderArrows(primaryArrows.length > 0 ? primaryArrows : fallbackArrows);
    this.renderTexts(frames[activeIdx].texts ?? [], frames[activeIdx].note ?? '');
    this.ghostLayer.destroyChildren();
    this.shapesLayer.batchDraw();
    this.ghostLayer.batchDraw();
    this.entityLayer.batchDraw();
    this.drawingLayer.batchDraw();
  }

  private showStatus(message: string) {
    this.statusMessage.set(message);
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => this.statusMessage.set(''), 2800);
  }

  // Konva Core
  private stage!: Konva.Stage;
  private pitchLayer!: Konva.Layer;
  private divisionsLayer!: Konva.Layer;
  private shapesLayer!: Konva.Layer;
  private ghostLayer!: Konva.Layer;
  private drawingLayer!: Konva.Layer;
  private entityLayer!: Konva.Layer;
  private resizeObserver!: ResizeObserver;

  // Drawing State
  private currentArrow: Konva.Group | null = null;
  private currentShape: Konva.Shape | null = null;
  private currentArrowStart: [number, number] = [0, 0];
  private currentArrowEnd: [number, number] = [0, 0];
  private freehandPoints: number[] = [];

  private readonly BASE_WIDTH = 1050;
  private readonly BASE_HEIGHT = 680;

  ngAfterViewInit() {
    // Load shared scheme from URL hash if present
    const fromUrl = decodeSchemeHash(window.location.hash);
    if (fromUrl) {
      this.store.importBoard(fromUrl);
      this.showStatus('Loaded tactical scheme from shared link');
    }

    const testCanvas = document.createElement('canvas');
    let has2dContext = false;
    try {
      has2dContext = !!testCanvas.getContext('2d');
    } catch {
      has2dContext = false;
    }
    if (!has2dContext) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.initCanvas();
      this.drawPitch();
      this.drawDivisions();
      this.syncFromStore();
      this.setupDrawingEngine();
      this.setupResponsiveObserver();
    });
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  toggleDivisions() {
    this.showDivisions.set(!this.showDivisions());
    this.divisionsLayer.visible(this.showDivisions());
    this.divisionsLayer.batchDraw();
  }

  private drawDivisions() {
    if (!this.divisionsLayer) return;
    this.divisionsLayer.destroyChildren();
    const W = this.BASE_WIDTH;
    const H = this.BASE_HEIGHT;
    const uprightRot = this.uprightRotation();
    const centreHalf = 183.2 / 2;
    const boxHalf = 403.2 / 2;
    const cy = H / 2;
    const lanes = [0, cy - boxHalf, cy - centreHalf, cy + centreHalf, cy + boxHalf, H];
    const laneNames = ['Left wing', 'Left half-space', 'Centre', 'Right half-space', 'Right wing'];
    const dashed = {
      stroke: 'rgba(255, 255, 255, 0.55)',
      strokeWidth: 2,
      dash: [10, 8],
      listening: false,
    };
    const label = {
      fontSize: 13,
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      fill: 'rgba(255, 255, 255, 0.75)',
      rotation: uprightRot,
      listening: false,
    };

    [
      [lanes[1], lanes[2]],
      [lanes[3], lanes[4]],
    ].forEach(([from, to]) => {
      this.divisionsLayer.add(
        new Konva.Rect({
          x: 0,
          y: from,
          width: W,
          height: to - from,
          fill: 'rgba(255, 235, 59, 0.14)',
          listening: false,
        })
      );
    });

    this.divisionsLayer.add(
      new Konva.Rect({
        x: 0,
        y: cy - boxHalf,
        width: 165,
        height: 403.2,
        fill: 'rgba(255, 255, 255, 0.10)',
        listening: false,
      }),
      new Konva.Rect({
        x: W - 165,
        y: cy - boxHalf,
        width: 165,
        height: 403.2,
        fill: 'rgba(255, 255, 255, 0.10)',
        listening: false,
      })
    );

    lanes.slice(1, -1).forEach((y) => {
      this.divisionsLayer.add(new Konva.Line({ points: [0, y, W, y], ...dashed }));
    });

    [W / 3, (2 * W) / 3].forEach((x) => {
      this.divisionsLayer.add(new Konva.Line({ points: [x, 0, x, H], ...dashed }));
    });
    ['Defensive third', 'Middle third', 'Final third'].forEach((name, i) => {
      this.divisionsLayer.add(
        new Konva.Text({
          text: name,
          x: (W / 3) * i + 24,
          y: uprightRot === 0 ? 8 : 120,
          ...label,
        })
      );
    });

    laneNames.forEach((name, i) => {
      const mid = (lanes[i] + lanes[i + 1]) / 2;
      this.divisionsLayer.add(new Konva.Text({ text: name, x: 215, y: mid - 7, ...label }));
    });
    this.divisionsLayer.batchDraw();
  }

  private initCanvas() {
    const container = this.canvasContainer.nativeElement;
    this.stage = new Konva.Stage({
      container: container,
      width: container.offsetWidth,
      height: container.offsetHeight,
    });

    this.pitchLayer = new Konva.Layer({ listening: false });
    this.divisionsLayer = new Konva.Layer({ visible: false, listening: false });
    this.shapesLayer = new Konva.Layer();
    this.ghostLayer = new Konva.Layer({ listening: false });
    this.drawingLayer = new Konva.Layer();
    this.entityLayer = new Konva.Layer();

    this.stage.add(this.pitchLayer);
    this.stage.add(this.divisionsLayer);
    this.stage.add(this.shapesLayer);
    this.stage.add(this.ghostLayer);
    this.stage.add(this.drawingLayer);
    this.stage.add(this.entityLayer);
  }

  private setupResponsiveObserver() {
    const container = this.canvasContainer.nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      this.applyStageViewport();
    });
    this.resizeObserver.observe(container);
  }

  private applyStageViewport() {
    if (!this.stage || !this.canvasContainer) return;
    const container = this.canvasContainer.nativeElement;
    const cw = container.offsetWidth || FULL_VIEW_W;
    const view = this.pitchView();

    if (view === 'vertical') {
      // Portrait 728x1122 view (including outer apron + protruding top/bottom goal nets)
      const scale = cw / FULL_VIEW_H;
      this.stage.width(FULL_VIEW_H * scale);
      this.stage.height(FULL_VIEW_W * scale);
      this.stage.rotation(90);
      this.stage.x((this.BASE_HEIGHT + PITCH_PAD_Y) * scale);
      this.stage.y(PITCH_PAD_X * scale);
      this.stage.scale({ x: scale, y: scale });
    } else if (view === 'half-left') {
      // Left half-pitch from outer left apron + protruding goal net (-36) to halfway line (+6)
      const scale = cw / HALF_VIEW_W;
      const ch = FULL_VIEW_H * scale;
      this.stage.width(cw);
      this.stage.height(ch);
      this.stage.rotation(0);
      this.stage.x(PITCH_PAD_X * scale);
      this.stage.y(PITCH_PAD_Y * scale);
      this.stage.scale({ x: scale, y: scale });
    } else if (view === 'half-right') {
      // Right half-pitch from halfway line (525 - 6) to outer right apron + protruding goal net (1050 + 36)
      const scale = cw / HALF_VIEW_W;
      const ch = FULL_VIEW_H * scale;
      this.stage.width(cw);
      this.stage.height(ch);
      this.stage.rotation(0);
      this.stage.x(-(this.BASE_WIDTH / 2 - 6) * scale);
      this.stage.y(PITCH_PAD_Y * scale);
      this.stage.scale({ x: scale, y: scale });
    } else {
      // Full horizontal pitch including outer apron and both protruding goal nets
      const scale = cw / FULL_VIEW_W;
      this.stage.width(FULL_VIEW_W * scale);
      this.stage.height(FULL_VIEW_H * scale);
      this.stage.rotation(0);
      this.stage.x(PITCH_PAD_X * scale);
      this.stage.y(PITCH_PAD_Y * scale);
      this.stage.scale({ x: scale, y: scale });
    }
    this.stage.batchDraw();
  }

  /** Clamps a Konva dragBoundFunc screen position into internal pitch coordinates (allowing the ball into protruding goal nets). */
  private clampStageDragPos(
    pos: { x: number; y: number },
    margin: number,
    allowGoalNet = false
  ): { x: number; y: number } {
    const absTransform = this.stage.getAbsoluteTransform();
    const inv = absTransform.copy().invert();
    const internal = inv.point(pos);
    const inGoalY =
      allowGoalNet && internal.y >= GOAL_TOP + 6 && internal.y <= GOAL_TOP + GOAL_WIDTH - 6;
    const minX = inGoalY ? -GOAL_DEPTH + 6 : margin;
    const maxX = inGoalY ? this.BASE_WIDTH + GOAL_DEPTH - 6 : this.BASE_WIDTH - margin;
    const clamped = {
      x: Math.max(minX, Math.min(maxX, internal.x)),
      y: Math.max(margin, Math.min(this.BASE_HEIGHT - margin, internal.y)),
    };
    return absTransform.point(clamped);
  }

  /** Converts pointer position on stage to internal 1050x680 pitch coordinates regardless of view/rotation. */
  private getInternalPointerPos(): [number, number] | null {
    const transform = this.stage.getAbsoluteTransform().copy().invert();
    const pos = this.stage.getPointerPosition();
    if (!pos) return null;
    const mapped = transform.point(pos);
    const inGoalY = mapped.y >= GOAL_TOP && mapped.y <= GOAL_TOP + GOAL_WIDTH;
    const minX = inGoalY ? -GOAL_DEPTH : 0;
    const maxX = inGoalY ? this.BASE_WIDTH + GOAL_DEPTH : this.BASE_WIDTH;
    return [
      Math.max(minX, Math.min(maxX, mapped.x)),
      Math.max(0, Math.min(this.BASE_HEIGHT, mapped.y)),
    ];
  }

  private setupDrawingEngine() {
    this.stage.on('mousedown touchstart', (e) => {
      if (this.isPlaying() || this.isExporting()) return;

      if (this.activeTool() === 'move') {
        if (e.target === this.stage) {
          this.ngZone.run(() => this.selectedEntityId.set(null));
        }
        return;
      }

      if (this.activeTool() === 'eraser') return;
      if (e.target.name() === 'curve-handle') return;

      const internal = this.getInternalPointerPos();
      if (!internal) return;
      const [internalX, internalY] = internal;

      if (this.activeTool() === 'text') {
        const textVal = this.pendingText().trim();
        if (textVal) {
          this.ngZone.run(() => {
            this.store.addText({
              x: Math.round(internalX),
              y: Math.round(internalY),
              text: textVal,
              fontSize: this.textSize(),
              color: this.drawColor(),
            });
            this.showStatus('Text label placed (drag in Move mode or click in Eraser mode)');
          });
        }
        return;
      }

      this.currentArrowStart = [internalX, internalY];
      this.currentArrowEnd = [internalX, internalY];

      if (this.activeTool() === 'shape') {
        this.currentShape = this.createShapeNode({
          kind: this.shapeKind(),
          x1: internalX,
          y1: internalY,
          x2: internalX,
          y2: internalY,
          color: this.drawColor(),
        });
        this.shapesLayer.add(this.currentShape);
        return;
      }

      this.freehandPoints = [Math.round(internalX), Math.round(internalY)];
      this.currentArrow = this.createArrow({
        points: [internalX, internalY, internalX, internalY],
        style: this.arrowStyle(),
        color: this.drawColor(),
        strokeWidth: this.drawWidth(),
        pathPoints: this.freehandPoints,
      });

      this.drawingLayer.add(this.currentArrow);
    });

    this.stage.on('mousemove touchmove', () => {
      if (!this.isDrawingMode()) return;
      const internal = this.getInternalPointerPos();
      if (!internal) return;
      const [internalX, internalY] = internal;

      this.currentArrowEnd = [internalX, internalY];
      const [x1, y1] = this.currentArrowStart;

      if (this.activeTool() === 'shape' && this.currentShape) {
        this.currentShape.destroy();
        this.currentShape = this.createShapeNode({
          kind: this.shapeKind(),
          x1,
          y1,
          x2: internalX,
          y2: internalY,
          color: this.drawColor(),
        });
        this.shapesLayer.add(this.currentShape);
        this.shapesLayer.batchDraw();
        return;
      }

      if (!this.currentArrow) return;

      if (this.arrowStyle() === 'freehand') {
        const lastX = this.freehandPoints[this.freehandPoints.length - 2];
        const lastY = this.freehandPoints[this.freehandPoints.length - 1];
        if (Math.hypot(internalX - lastX, internalY - lastY) >= 6) {
          this.freehandPoints.push(Math.round(internalX), Math.round(internalY));
        }
      }

      this.updateArrowGroup(
        this.currentArrow,
        [x1, y1, internalX, internalY],
        this.arrowStyle(),
        undefined,
        this.freehandPoints
      );
      this.drawingLayer.batchDraw();
    });

    this.stage.on('mouseup touchend', () => {
      if (this.activeTool() === 'shape' && this.currentShape) {
        const shape = this.currentShape;
        this.currentShape = null;
        shape.destroy();
        const [x1, y1] = this.currentArrowStart;
        const [x2, y2] = this.currentArrowEnd;
        if (Math.hypot(x2 - x1, y2 - y1) < 12) {
          this.shapesLayer.batchDraw();
          return;
        }
        this.ngZone.run(() =>
          this.store.addShape({
            kind: this.shapeKind(),
            x1: Math.round(x1),
            y1: Math.round(y1),
            x2: Math.round(x2),
            y2: Math.round(y2),
            color: this.drawColor(),
          })
        );
        return;
      }

      const arrow = this.currentArrow;
      if (!arrow) return;
      this.currentArrow = null;

      const [x1, y1] = this.currentArrowStart;
      const [x2, y2] = this.currentArrowEnd;
      arrow.destroy();
      if (Math.hypot(x2 - x1, y2 - y1) < 10 && this.freehandPoints.length < 6) {
        this.drawingLayer.batchDraw();
        return;
      }
      const savedFreehand =
        this.arrowStyle() === 'freehand' ? [...this.freehandPoints] : undefined;
      this.ngZone.run(() =>
        this.store.addArrow(
          [Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2)],
          this.arrowStyle(),
          {
            color: this.drawColor(),
            strokeWidth: this.drawWidth(),
            pathPoints: savedFreehand,
          }
        )
      );
    });
  }

  private drawPitch() {
    this.pitchLayer.destroyChildren();
    const W = this.BASE_WIDTH;
    const H = this.BASE_HEIGHT;

    // Outer stadium apron / run-off surround (outside the white boundary lines, where goal nets protrude)
    this.pitchLayer.add(
      new Konva.Rect({
        x: -PITCH_PAD_X,
        y: -PITCH_PAD_Y,
        width: FULL_VIEW_W,
        height: FULL_VIEW_H,
        fill: '#4b633b',
        listening: false,
      })
    );

    // In-bounds pitch turf
    this.pitchLayer.add(
      new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: '#357a38', listening: false })
    );

    // Mowed stadium grass stripes (10 vertical bands)
    if (this.showStripes()) {
      const stripeCount = 10;
      const stripeW = W / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        if (i % 2 === 1) {
          this.pitchLayer.add(
            new Konva.Rect({
              x: i * stripeW,
              y: 0,
              width: stripeW,
              height: H,
              fill: 'rgba(0, 0, 0, 0.075)',
              listening: false,
            })
          );
        }
      }
    }

    if (!this.showMarkings()) return;

    const lineConfig = { stroke: '#ffffff', strokeWidth: 3.5, listening: false };

    const boundary = new Konva.Rect({ x: 0, y: 0, width: W, height: H, ...lineConfig });
    const halfwayLine = new Konva.Line({ points: [W / 2, 0, W / 2, H], ...lineConfig });
    const centerCircle = new Konva.Circle({ x: W / 2, y: H / 2, radius: 91.5, ...lineConfig });
    const centerSpot = new Konva.Circle({
      x: W / 2,
      y: H / 2,
      radius: 4,
      fill: '#ffffff',
      listening: false,
    });

    const leftBox = new Konva.Rect({ x: 0, y: (H - 403.2) / 2, width: 165, height: 403.2, ...lineConfig });
    const rightBox = new Konva.Rect({
      x: W - 165,
      y: (H - 403.2) / 2,
      width: 165,
      height: 403.2,
      ...lineConfig,
    });
    const leftGoalArea = new Konva.Rect({ x: 0, y: (H - 183.2) / 2, width: 55, height: 183.2, ...lineConfig });
    const rightGoalArea = new Konva.Rect({
      x: W - 55,
      y: (H - 183.2) / 2,
      width: 55,
      height: 183.2,
      ...lineConfig,
    });

    // Penalty spots & penalty arcs
    const leftPenSpot = new Konva.Circle({
      x: 110,
      y: H / 2,
      radius: 3.8,
      fill: '#ffffff',
      listening: false,
    });
    const rightPenSpot = new Konva.Circle({
      x: W - 110,
      y: H / 2,
      radius: 3.8,
      fill: '#ffffff',
      listening: false,
    });
    const leftArc = new Konva.Arc({
      x: 110,
      y: H / 2,
      innerRadius: 91.5,
      outerRadius: 91.5,
      angle: 106,
      rotation: -53,
      ...lineConfig,
    });
    const rightArc = new Konva.Arc({
      x: W - 110,
      y: H / 2,
      innerRadius: 91.5,
      outerRadius: 91.5,
      angle: 106,
      rotation: 127,
      ...lineConfig,
    });

    // Protruding Woven Goal Nets OUTSIDE the left (x: -GOAL_DEPTH..0) and right (x: W..W+GOAL_DEPTH) goal lines
    const buildGoalNet = (gx: number): Konva.Group => {
      const netGroup = new Konva.Group({ listening: false });
      const nw = GOAL_DEPTH;
      const nh = GOAL_WIDTH;
      const ny = GOAL_TOP;
      netGroup.add(
        new Konva.Rect({
          x: gx,
          y: ny,
          width: nw,
          height: nh,
          fill: 'rgba(15, 23, 42, 0.22)',
          stroke: '#ffffff',
          strokeWidth: 3,
          lineJoin: 'miter',
        })
      );
      // Dense horizontal net rungs (matching coaching board goal net style)
      for (let y = ny + 4.5; y < ny + nh - 2; y += 4.5) {
        netGroup.add(
          new Konva.Line({
            points: [gx, y, gx + nw, y],
            stroke: 'rgba(255, 255, 255, 0.72)',
            strokeWidth: 1.1,
          })
        );
      }
      // Vertical net mesh cords
      for (let x = gx + 5; x < gx + nw; x += 5) {
        netGroup.add(
          new Konva.Line({
            points: [x, ny, x, ny + nh],
            stroke: 'rgba(255, 255, 255, 0.55)',
            strokeWidth: 1,
          })
        );
      }
      return netGroup;
    };

    const leftNet = buildGoalNet(-GOAL_DEPTH);
    const rightNet = buildGoalNet(W);

    this.pitchLayer.add(
      leftNet,
      rightNet,
      boundary,
      halfwayLine,
      centerCircle,
      centerSpot,
      leftBox,
      rightBox,
      leftGoalArea,
      rightGoalArea,
      leftPenSpot,
      rightPenSpot,
      leftArc,
      rightArc
    );
  }

  /** Classic black & white football: white sphere, black centre pentagon, surrounding patches. */
  private addClassicBall(group: Konva.Group, r: number) {
    group.add(new Konva.Circle({ radius: r, fill: '#ffffff', stroke: '#111111', strokeWidth: 1.5 }));

    const pattern = new Konva.Group({
      clipFunc: (ctx) => {
        ctx.arc(0, 0, r, 0, Math.PI * 2, false);
      },
    });
    const black = '#111111';
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const pt = (deg: number, dist: number) => ({
      x: Math.cos(rad(deg)) * dist,
      y: Math.sin(rad(deg)) * dist,
    });

    for (let i = 0; i < 5; i++) {
      const a = i * 72 - 90;
      const next = a + 72;
      const inner = pt(a, r * 0.38);
      const outer = pt(a, r * 0.78);
      const outerNext = pt(next, r * 0.78);
      const mid = pt(a + 36, r * 0.62);

      pattern.add(
        new Konva.Line({ points: [inner.x, inner.y, outer.x, outer.y], stroke: black, strokeWidth: 1 })
      );
      pattern.add(
        new Konva.Line({
          points: [outer.x, outer.y, mid.x, mid.y, outerNext.x, outerNext.y],
          stroke: black,
          strokeWidth: 1,
          lineJoin: 'round',
        })
      );
      const rim = pt(a, r * 1.02);
      pattern.add(
        new Konva.RegularPolygon({
          x: rim.x,
          y: rim.y,
          sides: 5,
          radius: r * 0.42,
          rotation: a + 90 + 180,
          fill: black,
        })
      );
    }

    pattern.add(new Konva.RegularPolygon({ sides: 5, radius: r * 0.38, fill: black }));
    group.add(pattern);
    group.add(new Konva.Circle({ radius: r, stroke: black, strokeWidth: 1.5 }));
  }

  /** Synchronizes Konva entity nodes with BoardStore entities while preserving node references for tweens. */
  private syncEntities(entities: TacticalEntity[]) {
    if (!this.entityLayer) return;
    const wantedIds = new Set(entities.map((e) => e.id));

    // Remove deleted nodes
    this.entityLayer
      .getChildren()
      .slice()
      .forEach((child) => {
        if (!wantedIds.has(child.id())) child.destroy();
      });

    const isMove = this.activeTool() === 'move' && !this.isPlaying() && !this.isExporting();
    const isEraser = this.activeTool() === 'eraser' && !this.isPlaying() && !this.isExporting();
    const uprightRot = this.uprightRotation();
    this.entityLayer.listening(isMove || isEraser);

    entities.forEach((entity) => {
      let group = this.entityLayer.findOne<Konva.Group>('#' + entity.id);
      const isBall = entity.type === 'ball';
      const isEquip = entity.type === 'equipment';
      const radius = isBall ? 13 : 15;

      if (!group) {
        group = new Konva.Group({
          id: entity.id,
          x: entity.x,
          y: entity.y,
          draggable: isMove,
          dragBoundFunc: (pos) => this.clampStageDragPos(pos, radius, isBall),
        });

        group.on('mouseenter', () => {
          if (this.activeTool() === 'eraser' && entity.id !== 'ball') {
            this.setStageCursor(CURSORS.eraserHot);
          } else if (this.activeTool() === 'move' && !this.isPlaying() && !this.isExporting()) {
            this.setStageCursor('grab');
          }
        });

        group.on('mouseleave', () => {
          this.setStageCursor(this.defaultToolCursor());
        });

        group.on('dragstart', () => {
          this.setStageCursor('grabbing');
        });

        group.on('dragend', () => {
          this.setStageCursor('grab');
          const newPos = group!.position();
          this.ngZone.run(() => {
            this.store.updatePosition(entity.id, Math.round(newPos.x), Math.round(newPos.y));
          });
        });

        group.on('click tap contextmenu', (e) => {
          e.evt?.preventDefault?.();
          if (this.activeTool() === 'eraser') {
            if (entity.id !== 'ball') {
              e.cancelBubble = true;
              this.ngZone.run(() => this.store.removeEntity(entity.id));
              this.setStageCursor(this.defaultToolCursor());
            }
            return;
          }
          if (this.activeTool() === 'move') {
            e.cancelBubble = true;
            this.ngZone.run(() => this.selectedEntityId.set(entity.id));
          }
        });

        this.entityLayer.add(group);
      }

      group.position({ x: entity.x, y: entity.y });
      if (isEquip) {
        const isPitchAligned = entity.equipmentKind && PITCH_ALIGNED_EQUIPMENT.has(entity.equipmentKind);
        group.rotation((isPitchAligned ? 0 : uprightRot) + (entity.rotation ?? 0));
      } else {
        group.rotation(0);
      }
      group.draggable(isMove);
      group.destroyChildren();

      // Selection ring when inspected
      if (this.selectedEntityId() === entity.id && !this.isPlaying() && !this.isExporting()) {
        group.add(
          new Konva.Circle({
            radius: radius + 6,
            stroke: '#fbbf24',
            strokeWidth: 2,
            dash: [4, 3],
            listening: false,
          })
        );
      }

      // Vision cone / orientation indicator for players (remains aligned with pitch facing angle)
      if (!isBall && !isEquip && entity.showVision) {
        const facing = entity.facing ?? (entity.type === 'away' ? 180 : 0);
        group.add(
          new Konva.Wedge({
            radius: 56,
            angle: 64,
            rotation: facing - 32,
            fill: 'rgba(250, 204, 21, 0.22)',
            stroke: 'rgba(250, 204, 21, 0.55)',
            strokeWidth: 1,
            listening: false,
          })
        );
      }

      if (isBall) {
        this.addClassicBall(group, radius);
      } else if (isEquip && entity.equipmentKind) {
        renderEquipmentShape(group, entity.equipmentKind, entity.color ?? '#f97316');
      } else {
        const fill =
          entity.color ??
          (entity.type === 'home'
            ? this.store.homeColor()
            : entity.type === 'away'
              ? this.store.awayColor()
              : '#eab308');
        group.add(
          new Konva.Circle({
            radius: radius,
            fill,
            stroke: '#ffffff',
            strokeWidth: 2,
          })
        );
      }

      // Upright sub-group for player jersey number, referee 'R', and player name badge so they never appear sideways in Vertical view
      if (!isBall && !isEquip && (entity.label || entity.name?.trim())) {
        const uprightGroup = new Konva.Group({
          rotation: uprightRot,
          listening: false,
        });

        if (entity.label) {
          uprightGroup.add(
            new Konva.Text({
              text: entity.label,
              fontSize: 13,
              fontFamily: 'sans-serif',
              fill: entity.type === 'referee' ? '#111827' : '#ffffff',
              fontStyle: 'bold',
              width: radius * 2,
              height: radius * 2,
              offsetX: radius,
              offsetY: radius,
              align: 'center',
              verticalAlign: 'middle',
              listening: false,
            })
          );
        }

        if (entity.name?.trim()) {
          const nameStr = entity.name.trim();
          const tagW = Math.max(38, nameStr.length * 6.8 + 10);
          uprightGroup.add(
            new Konva.Rect({
              x: -tagW / 2,
              y: radius + 3,
              width: tagW,
              height: 15,
              fill: 'rgba(17, 24, 39, 0.85)',
              cornerRadius: 3,
              listening: false,
            }),
            new Konva.Text({
              x: -tagW / 2,
              y: radius + 3,
              width: tagW,
              height: 15,
              text: nameStr,
              fontSize: 10,
              fontFamily: 'sans-serif',
              fontStyle: 'bold',
              fill: '#f9fafb',
              align: 'center',
              verticalAlign: 'middle',
              listening: false,
            })
          );
        }

        group.add(uprightGroup);
      }
    });
  }
}
