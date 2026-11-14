import { TacticalEntity } from './board.store';

export type FormationName =
  | '4-3-3'
  | '4-2-3-1'
  | '4-4-2'
  | '3-5-2'
  | '3-4-3'
  | '5-3-2'
  | '4-1-4-1';

export const FORMATION_NAMES: FormationName[] = [
  '4-3-3',
  '4-2-3-1',
  '4-4-2',
  '3-5-2',
  '3-4-3',
  '5-3-2',
  '4-1-4-1',
];

interface Pos {
  label: string;
  x: number;
  y: number;
}

/**
 * Canonical Home-team coordinates (defending left goal at x=0, attacking right toward x=1050)
 * on the 1050x680 internal grid. Away team coordinates are mirrored across the pitch center.
 */
const HOME_FORMATIONS: Record<FormationName, Pos[]> = {
  '4-3-3': [
    { label: '1', x: 50, y: 340 },
    { label: '2', x: 200, y: 580 },
    { label: '3', x: 200, y: 100 },
    { label: '4', x: 180, y: 420 },
    { label: '5', x: 180, y: 260 },
    { label: '6', x: 320, y: 340 },
    { label: '8', x: 360, y: 500 },
    { label: '10', x: 360, y: 180 },
    { label: '7', x: 480, y: 560 },
    { label: '9', x: 500, y: 340 },
    { label: '11', x: 480, y: 120 },
  ],
  '4-2-3-1': [
    { label: '1', x: 50, y: 340 },
    { label: '2', x: 200, y: 580 },
    { label: '3', x: 200, y: 100 },
    { label: '4', x: 180, y: 420 },
    { label: '5', x: 180, y: 260 },
    { label: '6', x: 300, y: 420 },
    { label: '8', x: 300, y: 260 },
    { label: '10', x: 390, y: 340 },
    { label: '7', x: 420, y: 540 },
    { label: '9', x: 500, y: 340 },
    { label: '11', x: 420, y: 140 },
  ],
  '4-4-2': [
    { label: '1', x: 50, y: 340 },
    { label: '2', x: 190, y: 580 },
    { label: '3', x: 190, y: 100 },
    { label: '4', x: 175, y: 420 },
    { label: '5', x: 175, y: 260 },
    { label: '6', x: 340, y: 410 },
    { label: '8', x: 340, y: 270 },
    { label: '7', x: 360, y: 565 },
    { label: '11', x: 360, y: 115 },
    { label: '9', x: 490, y: 410 },
    { label: '10', x: 490, y: 270 },
  ],
  '3-5-2': [
    { label: '1', x: 50, y: 340 },
    { label: '4', x: 180, y: 480 },
    { label: '5', x: 165, y: 340 },
    { label: '3', x: 180, y: 200 },
    { label: '2', x: 350, y: 590 },
    { label: '11', x: 350, y: 90 },
    { label: '6', x: 310, y: 340 },
    { label: '8', x: 375, y: 450 },
    { label: '10', x: 375, y: 230 },
    { label: '7', x: 495, y: 415 },
    { label: '9', x: 495, y: 265 },
  ],
  '3-4-3': [
    { label: '1', x: 50, y: 340 },
    { label: '4', x: 180, y: 480 },
    { label: '5', x: 165, y: 340 },
    { label: '3', x: 180, y: 200 },
    { label: '2', x: 340, y: 585 },
    { label: '6', x: 330, y: 415 },
    { label: '8', x: 330, y: 265 },
    { label: '11', x: 340, y: 95 },
    { label: '7', x: 480, y: 530 },
    { label: '9', x: 500, y: 340 },
    { label: '10', x: 480, y: 150 },
  ],
  '5-3-2': [
    { label: '1', x: 50, y: 340 },
    { label: '2', x: 220, y: 595 },
    { label: '4', x: 175, y: 465 },
    { label: '5', x: 160, y: 340 },
    { label: '6', x: 175, y: 215 },
    { label: '3', x: 220, y: 85 },
    { label: '8', x: 345, y: 455 },
    { label: '10', x: 330, y: 340 },
    { label: '11', x: 345, y: 225 },
    { label: '7', x: 490, y: 415 },
    { label: '9', x: 490, y: 265 },
  ],
  '4-1-4-1': [
    { label: '1', x: 50, y: 340 },
    { label: '2', x: 195, y: 580 },
    { label: '3', x: 195, y: 100 },
    { label: '4', x: 175, y: 420 },
    { label: '5', x: 175, y: 260 },
    { label: '6', x: 285, y: 340 },
    { label: '7', x: 400, y: 565 },
    { label: '8', x: 390, y: 425 },
    { label: '10', x: 390, y: 255 },
    { label: '11', x: 400, y: 115 },
    { label: '9', x: 500, y: 340 },
  ],
};

export type SquadPreset = '11v11' | '9v9' | '7v7' | '5v5' | 'empty';

export const SQUAD_PRESET_OPTIONS: { value: SquadPreset; label: string }[] = [
  { value: '11v11', label: '11v11 Full Match' },
  { value: '9v9', label: '9v9 Youth / Tactical' },
  { value: '7v7', label: '7v7 Small-Sided' },
  { value: '5v5', label: '5v5 Futsal / Drill' },
  { value: 'empty', label: 'Empty Pitch (Free Build)' },
];

const SMALL_SIDED_HOME: Record<'9v9' | '7v7' | '5v5', Pos[]> = {
  '9v9': [
    { label: '1', x: 50, y: 340 },
    { label: '2', x: 195, y: 510 },
    { label: '4', x: 180, y: 340 },
    { label: '3', x: 195, y: 170 },
    { label: '7', x: 350, y: 520 },
    { label: '6', x: 330, y: 340 },
    { label: '8', x: 350, y: 160 },
    { label: '10', x: 440, y: 400 },
    { label: '9', x: 485, y: 280 },
  ],
  '7v7': [
    { label: '1', x: 50, y: 340 },
    { label: '2', x: 195, y: 460 },
    { label: '3', x: 195, y: 220 },
    { label: '6', x: 340, y: 340 },
    { label: '7', x: 390, y: 500 },
    { label: '11', x: 390, y: 180 },
    { label: '9', x: 490, y: 340 },
  ],
  '5v5': [
    { label: '1', x: 55, y: 340 },
    { label: '4', x: 210, y: 340 },
    { label: '7', x: 360, y: 480 },
    { label: '11', x: 360, y: 200 },
    { label: '9', x: 485, y: 340 },
  ],
};

export function getFormationEntities(team: 'home' | 'away', formation: FormationName): TacticalEntity[] {
  const layout = HOME_FORMATIONS[formation] ?? HOME_FORMATIONS['4-3-3'];
  const prefix = team === 'home' ? 'h' : 'a';
  return layout.map((p) => ({
    id: `${prefix}${p.label}`,
    type: team,
    x: team === 'home' ? p.x : 1050 - p.x,
    y: team === 'home' ? p.y : 680 - p.y,
    label: p.label,
  }));
}

export function getSquadPresetEntities(
  preset: SquadPreset,
  homeFormation: FormationName = '4-3-3',
  awayFormation: FormationName = '4-3-3'
): TacticalEntity[] {
  if (preset === 'empty') {
    return [];
  }
  if (preset === '11v11') {
    return [
      ...getFormationEntities('home', homeFormation),
      ...getFormationEntities('away', awayFormation),
      { id: 'ball', type: 'ball', x: 525, y: 340 },
    ];
  }
  const homeLayout = SMALL_SIDED_HOME[preset];
  const homeEntities: TacticalEntity[] = homeLayout.map((p) => ({
    id: `h${p.label}`,
    type: 'home',
    x: p.x,
    y: p.y,
    label: p.label,
  }));
  const awayEntities: TacticalEntity[] = homeLayout.map((p) => ({
    id: `a${p.label}`,
    type: 'away',
    x: 1050 - p.x,
    y: 680 - p.y,
    label: p.label,
  }));
  return [...homeEntities, ...awayEntities, { id: 'ball', type: 'ball', x: 525, y: 340 }];
}
