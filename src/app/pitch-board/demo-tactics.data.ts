import { Snapshot } from './board.store';
import { getFormationEntities, SquadPreset } from './formations.data';

export interface TourStep {
  step: number;
  title: string;
  badge: string;
  description: string;
  tryLabel: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    title: 'Empty Pitch & Squad Modes (11v11, 7v7, 5v5, Empty)',
    badge: 'Squad & Drill Builder',
    description:
      'Switch the Mode selector between a full 11v11 match, 9v9/7v7/5v5 small-sided games, or an Empty Pitch where you can drag out just 2 or 3 players, balls, and cones to explain any tactical drill.',
    tryLabel: 'Try Empty Pitch + Palette',
  },
  {
    step: 2,
    title: 'Drag & Drop Players, Balls & Training Equipment',
    badge: 'Bench & Equipment Palette',
    description:
      'Drag any Home/Away player, Goalkeeper, Referee, Ball, Cone, Agility Ladder, Hurdle, Mannequin Wall, or Mini-Goal from the palette and drop it directly onto the exact spot on the grass.',
    tryLabel: 'Open Drag & Drop Palette',
  },
  {
    step: 3,
    title: 'Pitch Views (Full, Half-Pitch, Vertical) & Zoom up to 200%',
    badge: 'Views & Zoom',
    description:
      'Switch between Full Horizontal, Half Pitch (Left/Right) for set pieces, or Full Vertical (with auto-upright numbers and cones), and zoom from 70% up to 200%.',
    tryLabel: 'Preview Half-Pitch View',
  },
  {
    step: 4,
    title: '6 Tactical Arrow Styles, Zone Shapes, Text & Eraser',
    badge: 'Drawing & Annotations',
    description:
      'Sketch Pass, Run, Dribble, Target Zone, Block ┬ (screen), or Freehand lines. Bend any arrow using its white midpoint curve handle, highlight Rect/Circle/Triangle zones, or use the Eraser cursor to delete single items.',
    tryLabel: 'Load Tactical Arrows Demo',
  },
  {
    step: 5,
    title: 'Player Token Inspector & Directional Vision Cones',
    badge: 'Player Customization',
    description:
      'Click any player in Move mode to customize their jersey number, add a Name/Role badge beneath the token, and toggle a 65° directional Vision Cone to show body orientation and scanning angles.',
    tryLabel: 'Inspect Playmaker #10',
  },
  {
    step: 6,
    title: 'Keyframe Animation Timeline & Client-Side MP4 / GIF / PNG Export',
    badge: 'Animation & Export',
    description:
      'Add keyframes (+ Frame), move players and the ball (even inside the protruding goal net for a ⚽ GOAL! celebration), press Play or Play Step, and export HD MP4 video, animated GIF, or 2x PNG.',
    tryLabel: 'Play 3v2 Goal Scored Demo',
  },
];

export interface DemoTacticPreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  pitchView: 'full' | 'half-left' | 'half-right' | 'vertical';
  squadPreset: SquadPreset;
  frames: Snapshot[];
}

export const DEMO_TACTICS: DemoTacticPreset[] = [
  {
    id: 'demo-3v2-drill',
    title: '3v2 Overload Drill & Goal Scored',
    subtitle: 'Empty pitch drill with cones, mannequins, 3 attackers vs 2 defenders + GK, ending with a goal in the net',
    badge: 'Empty Pitch Drill',
    pitchView: 'half-right',
    squadPreset: 'empty',
    frames: [
      {
        note: 'Step 1: Coach plays ball into #10 between the cones — wingers #7 and #11 sprint wide',
        entities: [
          { id: 'h10', type: 'home', x: 600, y: 340, label: '10', name: 'Playmaker', showVision: true, facing: 0 },
          { id: 'h7', type: 'home', x: 640, y: 510, label: '7', name: 'RW' },
          { id: 'h11', type: 'home', x: 640, y: 170, label: '11', name: 'LW' },
          { id: 'a4', type: 'away', x: 790, y: 410, label: '4', name: 'CB', showVision: true, facing: 180 },
          { id: 'a5', type: 'away', x: 790, y: 270, label: '5', name: 'CB', showVision: true, facing: 180 },
          { id: 'a1', type: 'away', x: 1015, y: 340, label: '1', name: 'GK' },
          { id: 'eq-c1', type: 'equipment', equipmentKind: 'cone', x: 560, y: 290, color: '#f97316' },
          { id: 'eq-c2', type: 'equipment', equipmentKind: 'cone', x: 560, y: 390, color: '#f97316' },
          { id: 'eq-m1', type: 'equipment', equipmentKind: 'mannequin', x: 710, y: 340, color: '#f59e0b' },
          { id: 'ball', type: 'ball', x: 618, y: 340 },
        ],
        arrows: [
          { id: 'a1', style: 'dribble', points: [618, 340, 745, 305], color: '#f1c40f', strokeWidth: 4 },
          { id: 'a2', style: 'run', points: [640, 170, 845, 195], controlPoint: [745, 150], color: '#38bdf8', strokeWidth: 4 },
          { id: 'a3', style: 'run', points: [640, 510, 855, 465], controlPoint: [755, 520], color: '#38bdf8', strokeWidth: 4 },
        ],
        shapes: [
          { id: 's1', kind: 'ellipse', x1: 820, y1: 165, x2: 920, y2: 255, color: '#4ade80' },
        ],
        texts: [{ id: 't1', x: 710, y: 105, text: '3v2 OVERLOAD', fontSize: 18, color: '#f1c40f' }],
      },
      {
        note: 'Step 2: #10 draws CB #5 and slips a through-ball into the target zone for #11',
        entities: [
          { id: 'h10', type: 'home', x: 745, y: 305, label: '10', name: 'Playmaker', showVision: true, facing: -25 },
          { id: 'h7', type: 'home', x: 855, y: 465, label: '7', name: 'RW' },
          { id: 'h11', type: 'home', x: 845, y: 195, label: '11', name: 'LW' },
          { id: 'a4', type: 'away', x: 855, y: 410, label: '4', name: 'CB', showVision: true, facing: 160 },
          { id: 'a5', type: 'away', x: 785, y: 295, label: '5', name: 'CB', showVision: true, facing: 180 },
          { id: 'a1', type: 'away', x: 1010, y: 320, label: '1', name: 'GK' },
          { id: 'eq-c1', type: 'equipment', equipmentKind: 'cone', x: 560, y: 290, color: '#f97316' },
          { id: 'eq-c2', type: 'equipment', equipmentKind: 'cone', x: 560, y: 390, color: '#f97316' },
          { id: 'eq-m1', type: 'equipment', equipmentKind: 'mannequin', x: 710, y: 340, color: '#f59e0b' },
          { id: 'ball', type: 'ball', x: 760, y: 300 },
        ],
        arrows: [
          { id: 'a4', style: 'pass', points: [760, 300, 915, 245], color: '#f1c40f', strokeWidth: 4 },
          { id: 'a5', style: 'run', points: [845, 195, 920, 245], color: '#4ade80', strokeWidth: 4 },
          { id: 'a6', style: 'pass', points: [925, 250, 1058, 352], color: '#ef4444', strokeWidth: 5 },
        ],
        shapes: [],
        texts: [{ id: 't2', x: 920, y: 145, text: 'FIRST-TIME FINISH', fontSize: 18, color: '#ef4444' }],
      },
      {
        note: 'Step 3: #11 strikes across the keeper into the bottom corner — GOAL!',
        entities: [
          { id: 'h10', type: 'home', x: 820, y: 310, label: '10', name: 'Playmaker', showVision: true, facing: 0 },
          { id: 'h7', type: 'home', x: 945, y: 395, label: '7', name: 'RW' },
          { id: 'h11', type: 'home', x: 925, y: 250, label: '11', name: 'LW' },
          { id: 'a4', type: 'away', x: 930, y: 380, label: '4', name: 'CB' },
          { id: 'a5', type: 'away', x: 885, y: 285, label: '5', name: 'CB' },
          { id: 'a1', type: 'away', x: 1012, y: 315, label: '1', name: 'GK' },
          { id: 'eq-c1', type: 'equipment', equipmentKind: 'cone', x: 560, y: 290, color: '#f97316' },
          { id: 'eq-c2', type: 'equipment', equipmentKind: 'cone', x: 560, y: 390, color: '#f97316' },
          { id: 'eq-m1', type: 'equipment', equipmentKind: 'mannequin', x: 710, y: 340, color: '#f59e0b' },
          { id: 'ball', type: 'ball', x: 1058, y: 355 },
        ],
        arrows: [],
        shapes: [],
        texts: [],
      },
    ],
  },
  {
    id: 'demo-high-press',
    title: 'High Press & Midfield Trap (11v11)',
    subtitle: 'Curved pressing runs, cover shadow Block ┬ screen, and turnover transition',
    badge: '11v11 Match Tactic',
    pitchView: 'full',
    squadPreset: '11v11',
    frames: [
      {
        note: 'Phase 1: #9 curves his press to cut the CB-to-CB pass while #10 screens the pivot',
        entities: [
          ...getFormationEntities('home', '4-3-3').map((e) =>
            e.id === 'h9'
              ? { ...e, x: 640, y: 340, name: 'Striker', showVision: true, facing: 0 }
              : e.id === 'h10'
                ? { ...e, x: 555, y: 235, name: 'AM', showVision: true, facing: 15 }
                : e.id === 'h8'
                  ? { ...e, x: 555, y: 445, showVision: true, facing: -15 }
                  : e
          ),
          ...getFormationEntities('away', '4-3-3'),
          { id: 'ball', type: 'ball', x: 855, y: 260 },
        ],
        arrows: [
          { id: 'hp1', style: 'run', points: [640, 340, 825, 265], controlPoint: [730, 365], color: '#f1c40f', strokeWidth: 4 },
          { id: 'hp2', style: 'block', points: [555, 235, 695, 325], color: '#ef4444', strokeWidth: 4 },
          { id: 'hp3', style: 'zone', points: [480, 120, 770, 130], color: '#38bdf8', strokeWidth: 4 },
        ],
        shapes: [
          { id: 'hps1', kind: 'ellipse', x1: 680, y1: 285, x2: 785, y2: 395, color: '#ef4444' },
        ],
        texts: [{ id: 'hpt1', x: 732, y: 425, text: 'PIVOT SCREENED', fontSize: 14, color: '#ef4444' }],
      },
      {
        note: 'Phase 2: Forced wide pass is intercepted in the half-space — quick vertical transition!',
        entities: [
          ...getFormationEntities('home', '4-3-3').map((e) =>
            e.id === 'h9'
              ? { ...e, x: 815, y: 270, name: 'Striker', showVision: true, facing: -35 }
              : e.id === 'h11'
                ? { ...e, x: 765, y: 125, name: 'LW' }
                : e.id === 'h10'
                  ? { ...e, x: 690, y: 280, name: 'AM', showVision: true, facing: 0 }
                  : e
          ),
          ...getFormationEntities('away', '4-3-3'),
          { id: 'ball', type: 'ball', x: 775, y: 135 },
        ],
        arrows: [
          { id: 'hp4', style: 'pass', points: [775, 135, 885, 295], color: '#4ade80', strokeWidth: 4 },
          { id: 'hp5', style: 'run', points: [815, 270, 900, 305], color: '#f1c40f', strokeWidth: 4 },
          { id: 'hp6', style: 'pass', points: [905, 305, 1058, 345], color: '#ef4444', strokeWidth: 5 },
        ],
        shapes: [],
        texts: [{ id: 'hpt2', x: 840, y: 190, text: 'TURNOVER & CUTBACK', fontSize: 16, color: '#4ade80' }],
      },
    ],
  },
  {
    id: 'demo-corner-setpiece',
    title: 'In-Swinging Corner Routine (Set Piece)',
    subtitle: 'Near-post screen block, decoy run, and back-post header into the goal net',
    badge: 'Set Piece',
    pitchView: 'half-right',
    squadPreset: 'empty',
    frames: [
      {
        note: 'Corner Step 1: #7 prepares in-swinger; #4 blocks the keeper while #9 and #5 attack the box',
        entities: [
          { id: 'h7', type: 'home', x: 1042, y: 18, label: '7', name: 'Corner Taker' },
          { id: 'h4', type: 'home', x: 998, y: 325, label: '4', name: 'Blocker' },
          { id: 'h9', type: 'home', x: 915, y: 290, label: '9', name: 'Near Post' },
          { id: 'h5', type: 'home', x: 895, y: 410, label: '5', name: 'Target CB' },
          { id: 'h8', type: 'home', x: 835, y: 340, label: '8', name: 'Edge Box' },
          { id: 'a1', type: 'away', x: 1020, y: 340, label: '1', name: 'GK' },
          { id: 'a4', type: 'away', x: 955, y: 300, label: '4' },
          { id: 'a5', type: 'away', x: 950, y: 385, label: '5' },
          { id: 'a6', type: 'away', x: 985, y: 275, label: '6' },
          { id: 'ball', type: 'ball', x: 1044, y: 14 },
        ],
        arrows: [
          { id: 'c1', style: 'pass', points: [1044, 14, 982, 368], controlPoint: [940, 180], color: '#f1c40f', strokeWidth: 4 },
          { id: 'c2', style: 'block', points: [998, 325, 1012, 335], color: '#ef4444', strokeWidth: 4 },
          { id: 'c3', style: 'run', points: [915, 290, 990, 265], color: '#38bdf8', strokeWidth: 4 },
          { id: 'c4', style: 'zone', points: [895, 410, 982, 368], color: '#4ade80', strokeWidth: 4 },
        ],
        shapes: [],
        texts: [{ id: 'ct1', x: 890, y: 205, text: 'IN-SWINGER TO BACK POST', fontSize: 16, color: '#f1c40f' }],
      },
      {
        note: 'Corner Step 2: #5 meets the in-swinging delivery at the back post and heads it into the net!',
        entities: [
          { id: 'h7', type: 'home', x: 1030, y: 35, label: '7', name: 'Corner Taker' },
          { id: 'h4', type: 'home', x: 1008, y: 332, label: '4', name: 'Blocker' },
          { id: 'h9', type: 'home', x: 990, y: 265, label: '9', name: 'Near Post' },
          { id: 'h5', type: 'home', x: 982, y: 368, label: '5', name: 'Target CB' },
          { id: 'h8', type: 'home', x: 865, y: 340, label: '8', name: 'Edge Box' },
          { id: 'a1', type: 'away', x: 1020, y: 335, label: '1', name: 'GK' },
          { id: 'a4', type: 'away', x: 980, y: 280, label: '4' },
          { id: 'a5', type: 'away', x: 968, y: 378, label: '5' },
          { id: 'a6', type: 'away', x: 992, y: 260, label: '6' },
          { id: 'ball', type: 'ball', x: 1058, y: 362 },
        ],
        arrows: [],
        shapes: [],
        texts: [],
      },
    ],
  },
];
