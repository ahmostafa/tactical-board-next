export type ArrowStyle = 'pass' | 'run' | 'dribble' | 'zone' | 'block' | 'freehand';

export type ShapeKind = 'rect' | 'ellipse' | 'triangle';

export type EquipmentKind =
  | 'cone'
  | 'disc'
  | 'donut'
  | 'marker'
  | 'hurdle'
  | 'ladder'
  | 'pole'
  | 'mannequin'
  | 'ring'
  | 'minigoal'
  | 'goalnet';

export type FormationName =
  | '4-3-3'
  | '4-2-3-1'
  | '4-4-2'
  | '3-5-2'
  | '3-4-3'
  | '5-3-2'
  | '4-1-4-1';

export type SquadPreset = '11v11' | '9v9' | '7v7' | '5v5' | 'empty';

export type PitchViewMode = 'full' | 'half-left' | 'half-right' | 'vertical';

export type ActiveToolMode = 'move' | 'arrow' | 'shape' | 'text' | 'eraser';

export interface TacticalEntity {
  id: string;
  type: 'home' | 'away' | 'ball' | 'referee' | 'equipment';
  x: number;
  y: number;
  label?: string;
  /** Optional player name or role tag shown beneath the token. */
  name?: string;
  /** Optional custom token color override. */
  color?: string;
  /** Facing angle in degrees (0 = right, 90 = down, 180 = left, 270 = up). */
  facing?: number;
  /** Whether to render a directional vision cone for this player. */
  showVision?: boolean;
  /** Training equipment sub-type when type === 'equipment'. */
  equipmentKind?: EquipmentKind;
  /** Rotation angle in degrees for rotatable equipment (ladder, mini-goal, hurdle). */
  rotation?: number;
}

export interface TacticalArrow {
  id: string;
  points: [number, number, number, number];
  style?: ArrowStyle;
  /** Quadratic Bézier control point in pitch coordinates; omit for a straight arrow. */
  controlPoint?: [number, number];
  /** Stroke & pointer color (defaults to #f1c40f). */
  color?: string;
  /** Stroke thickness (defaults to 4). */
  strokeWidth?: number;
  /** Multi-point freehand path when style === 'freehand'. */
  pathPoints?: number[];
}

export interface TacticalShape {
  id: string;
  kind: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface TacticalText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export interface Snapshot {
  entities: TacticalEntity[];
  arrows: TacticalArrow[];
  shapes?: TacticalShape[];
  texts?: TacticalText[];
  note?: string;
}

export interface PaletteDragPayload {
  category: 'squad' | 'equipment';
  squadType?: 'home' | 'away' | 'referee' | 'ball';
  roleLabel?: string;
  roleName?: string;
  equipmentKind?: EquipmentKind;
  defaultColor?: string;
}

export interface TourStep {
  step: number;
  title: string;
  badge: string;
  description: string;
  tryLabel: string;
}

export interface DemoTacticPreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  pitchView: PitchViewMode;
  squadPreset: SquadPreset;
  frames: Snapshot[];
}

export interface SavedCollectionItem {
  id: string;
  title: string;
  category: 'Match Tactic' | 'Set Piece' | 'Training Drill';
  updatedAt: string;
  frameCount: number;
  data: any;
}

/** Pitch goal mouth and outer apron margins (internal 1050x680 coordinates). */
export const BASE_WIDTH = 1050;
export const BASE_HEIGHT = 680;
export const GOAL_WIDTH = 73.2;
export const GOAL_TOP = (BASE_HEIGHT - GOAL_WIDTH) / 2;
export const GOAL_DEPTH = 20;
export const PITCH_PAD_X = 36;
export const PITCH_PAD_Y = 24;
export const FULL_VIEW_W = BASE_WIDTH + PITCH_PAD_X * 2; // 1122
export const FULL_VIEW_H = BASE_HEIGHT + PITCH_PAD_Y * 2; // 728
export const HALF_VIEW_W = PITCH_PAD_X + 525 + 7; // 568 (even width: outer apron + protruding goal net -> halfway line)

export const STORAGE_KEY = 'tactical-board:v1';

export const BOARD_ZOOM_LEVELS = [0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];

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
