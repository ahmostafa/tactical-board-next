import Konva from 'konva';
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  PitchDivisionsConfig,
  PitchViewMode,
  TacticalLocationSummary,
} from '../models/tactical-board.models';

/**
 * FIFA 105m x 68m Channel Boundaries (in meters along Y-axis):
 * 0.00 - 13.84 : Left Flank (LF)
 * 13.84 - 24.84: Left Half-Space (LHS)
 * 24.84 - 43.16: Central Corridor (C)
 * 43.16 - 54.16: Right Half-Space (RHS)
 * 54.16 - 68.00: Right Flank (RF)
 */
export const CHANNEL_BOUNDS_METERS = [0, 13.84, 24.84, 43.16, 54.16, 68] as const;
export const CHANNEL_BOUNDS_PX = CHANNEL_BOUNDS_METERS.map((m) => m * 10);

export const DEFAULT_DIVISIONS_CONFIG: PitchDivisionsConfig = {
  grid: 'none',
  subZones: {
    zone14: false,
    goldenZone: false,
    pockets: false,
    cutback: false,
  },
  mirrorSubZones: false,
};

/**
 * Maps normalized FIFA meter coordinates (x in [0, 105], y in [0, 68])
 * to the Standard 18-Zone Grid (1..18).
 */
export function getZone18(x: number, y: number): number {
  const col = Math.min(2, Math.max(0, Math.floor(y / (68 / 3)))); // 0: Left, 1: Center, 2: Right
  const row = Math.min(5, Math.max(0, Math.floor(x / (105 / 6)))); // 0..5 from own goal to opp goal
  return row * 3 + col + 1;
}

/**
 * Maps normalized FIFA meter coordinates (x in [0, 105], y in [0, 68])
 * to the 20-Zone Juego de Posición Grid ('B-LF' .. 'F-RF').
 */
export function getZone20(x: number, y: number): string {
  const getChannel = (yPos: number): string => {
    if (yPos < 13.84) return 'LF';
    if (yPos < 24.84) return 'LHS';
    if (yPos < 43.16) return 'C';
    if (yPos < 54.16) return 'RHS';
    return 'RF';
  };

  const tiers = ['B', 'P', 'C', 'F']; // Build-Up, Progression, Creation, Finishing
  const tierIndex = Math.min(3, Math.max(0, Math.floor(x / 26.25)));
  return `${tiers[tierIndex]}-${getChannel(y)}`;
}

export function getThirdName(
  xMeters: number
): 'Defensive Third' | 'Middle Third' | 'Final Third' {
  if (xMeters < 35) return 'Defensive Third';
  if (xMeters < 70) return 'Middle Third';
  return 'Final Third';
}

export function getChannelName(
  yMeters: number
): 'Left Flank' | 'Left Half-Space' | 'Central Corridor' | 'Right Half-Space' | 'Right Flank' {
  if (yMeters < 13.84) return 'Left Flank';
  if (yMeters < 24.84) return 'Left Half-Space';
  if (yMeters < 43.16) return 'Central Corridor';
  if (yMeters < 54.16) return 'Right Half-Space';
  return 'Right Flank';
}

export function getSpecializedSubZones(xMeters: number, yMeters: number): string[] {
  const tags: string[] = [];
  const inCentralLane = yMeters >= 22.67 && yMeters <= 45.33;
  const inSixYardWidth = yMeters >= 24.84 && yMeters <= 43.16;
  const inHalfSpace =
    (yMeters >= 13.84 && yMeters <= 24.84) || (yMeters >= 43.16 && yMeters <= 54.16);

  if (xMeters >= 70 && xMeters <= 88.5 && inCentralLane) {
    tags.push('Zone 14 (Assist)');
  } else if (xMeters >= 16.5 && xMeters <= 35 && inCentralLane) {
    tags.push('Own Zone 5');
  }

  if (xMeters >= 94 && xMeters <= 105 && inSixYardWidth) {
    tags.push('Golden Zone');
  } else if (xMeters >= 0 && xMeters <= 11 && inSixYardWidth) {
    tags.push('Own Golden Zone');
  }

  if (xMeters >= 52.5 && xMeters <= 88.5 && inHalfSpace) {
    tags.push('Half-Space Pocket');
  }

  if (xMeters >= 88.5 && xMeters <= 105 && inHalfSpace) {
    tags.push('Byline Cutback');
  } else if (xMeters >= 0 && xMeters <= 16.5 && inHalfSpace) {
    tags.push('Own Cutback Zone');
  }

  return tags;
}

/**
 * Converts internal canvas pixel coordinates (1050x680) into a complete tactical location summary.
 */
export function getTacticalLocationSummary(xPx: number, yPx: number): TacticalLocationSummary {
  const xMeters = Math.round(Math.max(0, Math.min(105, xPx / 10)) * 10) / 10;
  const yMeters = Math.round(Math.max(0, Math.min(68, yPx / 10)) * 10) / 10;
  return {
    xMeters,
    yMeters,
    zone18: getZone18(xMeters, yMeters),
    zone20: getZone20(xMeters, yMeters),
    third: getThirdName(xMeters),
    channel: getChannelName(yMeters),
    subZones: getSpecializedSubZones(xMeters, yMeters),
  };
}

export function isAnyDivisionActive(config: PitchDivisionsConfig): boolean {
  return (
    config.grid !== 'none' ||
    config.subZones.zone14 ||
    config.subZones.goldenZone ||
    config.subZones.pockets ||
    config.subZones.cutback
  );
}

/**
 * Draws the selected Primary Grid ('thirds-channels' | 'zones-18' | 'zones-20' | 'none')
 * and any enabled Specialized Tactical Sub-Zones onto `divisionsLayer`.
 */
export function drawPitchDivisions(
  divisionsLayer: Konva.Layer,
   uprightRot: number,
  config: PitchDivisionsConfig = DEFAULT_DIVISIONS_CONFIG,
  pitchView: PitchViewMode = 'full'
): void {
  divisionsLayer.destroyChildren();

  if (!isAnyDivisionActive(config)) {
    divisionsLayer.visible(false);
    divisionsLayer.batchDraw();
    return;
  }

  divisionsLayer.visible(true);

  if (config.grid === 'thirds-channels') {
    renderThirdsAndChannelsGrid(divisionsLayer, uprightRot);
  } else if (config.grid === 'zones-18') {
    render18ZoneGrid(divisionsLayer, uprightRot, config);
  } else if (config.grid === 'zones-20') {
    render20ZonePositionalGrid(divisionsLayer, uprightRot, config);
  }

  renderSpecializedSubZones(divisionsLayer, config, uprightRot, pitchView);
  divisionsLayer.batchDraw();
}

function addCenteredBadge(
  layer: Konva.Layer,
  cx: number,
  cy: number,
  mainText: string,
  subText: string | undefined,
  uprightRot: number,
  opts?: {
    fill?: string;
    stroke?: string;
    textColor?: string;
    subColor?: string;
    width?: number;
  }
) {
  const w = opts?.width ?? (subText ? Math.max(76, subText.length * 5.8 + 14) : 58);
  const h = subText ? 30 : 20;
  const g = new Konva.Group({
    x: cx,
    y: cy,
    rotation: uprightRot,
    listening: false,
  });
  g.add(
    new Konva.Rect({
      x: -w / 2,
      y: -h / 2,
      width: w,
      height: h,
      cornerRadius: 5,
      fill: opts?.fill ?? 'rgba(15, 23, 42, 0.72)',
      stroke: opts?.stroke ?? 'rgba(255, 255, 255, 0.32)',
      strokeWidth: 1,
    }),
    new Konva.Text({
      x: -w / 2,
      y: subText ? -h / 2 + 3 : -h / 2,
      width: w,
      height: subText ? 14 : h,
      text: mainText,
      fontSize: 11,
      fontStyle: 'bold',
      fontFamily: 'sans-serif',
      fill: opts?.textColor ?? '#f8fafc',
      align: 'center',
      verticalAlign: 'middle',
    })
  );
  if (subText) {
    g.add(
      new Konva.Text({
        x: -w / 2,
        y: -h / 2 + 16,
        width: w,
        height: 11,
        text: subText,
        fontSize: 9,
        fontStyle: 'bold',
        fontFamily: 'sans-serif',
        fill: opts?.subColor ?? '#fde047',
        align: 'center',
        verticalAlign: 'middle',
      })
    );
  }
  layer.add(g);
}

/**
 * 1. Fundamental Pitch Divisions: Horizontal Thirds (35m, 70m + 52.5m Midfield split)
 *    & 5 Vertical Channels anchored to penalty/goal area markings.
 */
function renderThirdsAndChannelsGrid(layer: Konva.Layer, uprightRot: number) {
  const W = BASE_WIDTH;
  const H = BASE_HEIGHT;
  const lanes = CHANNEL_BOUNDS_PX; // [0, 138.4, 248.4, 431.6, 541.6, 680]
  const laneNames = [
    'Left Flank (0–13.8m)',
    'Left Half-Space (13.8–24.8m)',
    'Central Corridor (24.8–43.2m)',
    'Right Half-Space (43.2–54.2m)',
    'Right Flank (54.2–68m)',
  ];

  // Subtle gold tint along Left & Right Half-Spaces
  [
    [lanes[1], lanes[2]],
    [lanes[3], lanes[4]],
  ].forEach(([from, to]) => {
    layer.add(
      new Konva.Rect({
        x: 0,
        y: from,
        width: W,
        height: to - from,
        fill: 'rgba(250, 204, 21, 0.11)',
        listening: false,
      })
    );
  });

  const dashed = {
    stroke: 'rgba(255, 255, 255, 0.58)',
    strokeWidth: 1.8,
    dash: [10, 8],
    listening: false,
  };

  // 4 internal channel lines
  lanes.slice(1, -1).forEach((y) => {
    layer.add(new Konva.Line({ points: [0, y, W, y], ...dashed }));
  });

  // 2 main Third boundary lines (35m = 350px, 70m = 700px)
  [350, 700].forEach((x) => {
    layer.add(
      new Konva.Line({
        points: [x, 0, x, H],
        stroke: 'rgba(250, 204, 21, 0.78)',
        strokeWidth: 2.2,
        dash: [12, 7],
        listening: false,
      })
    );
  });

  // Third headers
  const thirds: Array<{ title: string; sub: string; cx: number }> = [
    { title: 'DEFENSIVE THIRD', sub: '0m – 35m (Build-Up)', cx: 175 },
    { title: 'MIDDLE THIRD', sub: '35m – 70m (Low / High Mid)', cx: 525 },
    { title: 'FINAL THIRD', sub: '70m – 105m (Attacking)', cx: 875 },
  ];
  thirds.forEach((t) => {
    addCenteredBadge(layer, t.cx, 22, t.title, t.sub, uprightRot, {
      width: 148,
      fill: 'rgba(15, 23, 42, 0.80)',
      stroke: 'rgba(250, 204, 21, 0.55)',
    });
  });

  // 5 Channel labels in the middle third
  laneNames.forEach((name, i) => {
    const midY = (lanes[i] + lanes[i + 1]) / 2;
    const isHS = i === 1 || i === 3;
    addCenteredBadge(
      layer,
      260,
      midY,
      name,
      isHS ? 'Diagonal Passing / Pockets' : undefined,
      uprightRot,
      {
        width: 168,
        fill: isHS ? 'rgba(113, 63, 18, 0.76)' : 'rgba(15, 23, 42, 0.68)',
        stroke: isHS ? 'rgba(250, 204, 21, 0.65)' : 'rgba(255, 255, 255, 0.28)',
      }
    );
  });
}

/**
 * 2. The Standard 18-Zone Grid (3 Columns x 6 Rows), numbered 1..18 from own goal (X=0) to opponent goal (X=105m).
 */
function render18ZoneGrid(
  layer: Konva.Layer,
  uprightRot: number,
  config: PitchDivisionsConfig
) {
  const W = BASE_WIDTH;
  const H = BASE_HEIGHT;
  const colW = H / 3; // 226.67px (22.67m)
  const rowW = W / 6; // 175px (17.5m)

  const subtitles: Record<number, string> = {
    2: 'Own Box',
    5: 'Own Z14',
    8: 'Low Mid C',
    11: 'High Mid C',
    13: 'Left Wing',
    14: 'ASSIST ZONE',
    15: 'Right Wing',
    16: 'Left Byline',
    17: 'PENALTY BOX',
    18: 'Right Byline',
  };

  // Highlight Zone 14 & Zone 17 subtly inside the 18-zone grid
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      const zoneNum = row * 3 + col + 1;
      const x = row * rowW;
      const y = col * colW;

      if (
        (zoneNum === 14 && !config.subZones.zone14) ||
        (zoneNum === 17 && !config.subZones.goldenZone)
      ) {
        layer.add(
          new Konva.Rect({
            x,
            y,
            width: rowW,
            height: colW,
            fill: zoneNum === 14 ? 'rgba(245, 158, 11, 0.20)' : 'rgba(16, 185, 129, 0.18)',
            listening: false,
          })
        );
      }

      // Avoid double-drawing Zone 14 badge when the Zone 14 sub-zone overlay is also active
      if (zoneNum === 14 && config.subZones.zone14) continue;
      if (zoneNum === 5 && config.subZones.zone14 && config.mirrorSubZones) continue;

      const cx =
        zoneNum === 17 && config.subZones.goldenZone
          ? x + 46
          : zoneNum === 2 && config.subZones.goldenZone && config.mirrorSubZones
            ? x + rowW - 46
            : x + rowW / 2;
      const cy = y + colW / 2;
      const sub = subtitles[zoneNum];
      addCenteredBadge(
        layer,
        cx,
        cy,
        `ZONE ${zoneNum}`,
        sub,
        uprightRot,
        zoneNum === 14
          ? {
              fill: 'rgba(120, 53, 15, 0.88)',
              stroke: '#f59e0b',
              textColor: '#fef3c7',
              subColor: '#fbbf24',
              width: 88,
            }
          : zoneNum === 17
            ? {
                fill: 'rgba(6, 78, 59, 0.88)',
                stroke: '#10b981',
                textColor: '#ecfdf5',
                subColor: '#6ee7b7',
                width: 82,
              }
            : { width: 78 }
      );
    }
  }

  const dashed = {
    stroke: 'rgba(255, 255, 255, 0.55)',
    strokeWidth: 1.8,
    dash: [8, 6],
    listening: false,
  };

  // 2 horizontal lane dividers (22.67m, 45.33m)
  [colW, colW * 2].forEach((y) => {
    layer.add(new Konva.Line({ points: [0, y, W, y], ...dashed }));
  });

  // 5 vertical depth dividers (17.5m steps)
  for (let r = 1; r < 6; r++) {
    const x = r * rowW;
    layer.add(
      new Konva.Line({
        points: [x, 0, x, H],
        stroke: r === 2 || r === 4 ? 'rgba(250, 204, 21, 0.72)' : 'rgba(255, 255, 255, 0.50)',
        strokeWidth: r === 2 || r === 4 ? 2.2 : 1.6,
        dash: [8, 6],
        listening: false,
      })
    );
  }
}

/**
 * 3. The 20-Zone Juego de Posición Grid (5 Channels x 4 Functional Tiers: Build-Up, Progression, Creation, Finishing).
 */
function render20ZonePositionalGrid(
  layer: Konva.Layer,
  uprightRot: number,
  config: PitchDivisionsConfig
) {
  const W = BASE_WIDTH;
  const H = BASE_HEIGHT;
  const lanes = CHANNEL_BOUNDS_PX; // [0, 138.4, 248.4, 431.6, 541.6, 680]
  const channelCodes = ['LF', 'LHS', 'C', 'RHS', 'RF'];
  const tiers = [
    { code: 'B', name: 'Tier 1: Build-Up (0–26.25m)' },
    { code: 'P', name: 'Tier 2: Progression (26.25–52.5m)' },
    { code: 'C', name: 'Tier 3: Creation (52.5–78.75m)' },
    { code: 'F', name: 'Tier 4: Finishing (78.75–105m)' },
  ];
  const tierW = W / 4; // 262.5px (26.25m)

  for (let t = 0; t < 4; t++) {
    const x = t * tierW;
    // Tier header at top
    addCenteredBadge(layer, x + tierW / 2, 18, tiers[t].name, undefined, uprightRot, {
      width: 176,
      fill: 'rgba(15, 23, 42, 0.84)',
      stroke: 'rgba(56, 189, 248, 0.55)',
      textColor: '#bae6fd',
    });

    for (let c = 0; c < 5; c++) {
      const y1 = lanes[c];
      const y2 = lanes[c + 1];
      const code = `${tiers[t].code}-${channelCodes[c]}`;
      const isPrimePocket = code === 'C-LHS' || code === 'C-RHS';
      const isHalfSpace = c === 1 || c === 3;

      if (isPrimePocket && !config.subZones.pockets) {
        layer.add(
          new Konva.Rect({
            x,
            y: y1,
            width: tierW,
            height: y2 - y1,
            fill: 'rgba(56, 189, 248, 0.20)',
            listening: false,
          })
        );
      } else if (isHalfSpace && !config.subZones.pockets) {
        layer.add(
          new Konva.Rect({
            x,
            y: y1,
            width: tierW,
            height: y2 - y1,
            fill: 'rgba(250, 204, 21, 0.08)',
            listening: false,
          })
        );
      }

      if (isPrimePocket && config.subZones.pockets) continue;

      addCenteredBadge(
        layer,
        x + tierW / 2,
        (y1 + y2) / 2,
        code,
        isPrimePocket ? 'Prime Pocket' : undefined,
        uprightRot,
        isPrimePocket
          ? {
              fill: 'rgba(12, 74, 110, 0.90)',
              stroke: '#38bdf8',
              textColor: '#e0f2fe',
              subColor: '#7dd3fc',
              width: 84,
            }
          : { width: 58 }
      );
    }
  }

  // 4 channel lines
  lanes.slice(1, -1).forEach((y) => {
    layer.add(
      new Konva.Line({
        points: [0, y, W, y],
        stroke: 'rgba(255, 255, 255, 0.55)',
        strokeWidth: 1.6,
        dash: [8, 6],
        listening: false,
      })
    );
  });

  // 3 tier lines (26.25m, 52.5m, 78.75m)
  [tierW, tierW * 2, tierW * 3].forEach((x, idx) => {
    layer.add(
      new Konva.Line({
        points: [x, 0, x, H],
        stroke: idx === 1 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(255, 255, 255, 0.58)',
        strokeWidth: idx === 1 ? 2.2 : 1.8,
        dash: [10, 7],
        listening: false,
      })
    );
  });
}

/**
 * 4. Independent Specialized Tactical Sub-Zones (Zone 14, Golden Zone, The Pockets, Byline Cutback Zones).
 */
function renderSpecializedSubZones(
  layer: Konva.Layer,
  config: PitchDivisionsConfig,
  uprightRot: number,
  pitchView: PitchViewMode
) {
  const showRight = pitchView !== 'half-left';
  const showLeft = config.mirrorSubZones || pitchView === 'half-left';

  // A. Zone 14 (X: 70m-88.5m => 700..885px, Y: 22.67m-45.33m => 226.7..453.3px)
  if (config.subZones.zone14) {
    const drawZ14 = (x1: number, x2: number, label: string) => {
      const y1 = 226.7;
      const y2 = 453.3;
      layer.add(
        new Konva.Rect({
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
          fill: 'rgba(245, 158, 11, 0.28)',
          stroke: '#f59e0b',
          strokeWidth: 2.5,
          dash: [8, 5],
          cornerRadius: 6,
          listening: false,
        })
      );
      addCenteredBadge(
        layer,
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        label,
        '70–88.5m · Central Assist',
        uprightRot,
        {
          fill: 'rgba(120, 53, 15, 0.92)',
          stroke: '#fbbf24',
          textColor: '#fef3c7',
          subColor: '#fde68a',
          width: 132,
        }
      );
    };
    if (showRight) drawZ14(700, 885, 'ZONE 14 (ASSIST)');
    if (showLeft) drawZ14(165, 350, 'ZONE 5 (OWN Z14)');
  }

  // B. Golden Zone (X: 94m-105m => 940..1050px, Y: 24.84m-43.16m => 248.4..431.6px)
  if (config.subZones.goldenZone) {
    const drawGolden = (x1: number, x2: number, label: string) => {
      const y1 = 248.4;
      const y2 = 431.6;
      layer.add(
        new Konva.Rect({
          x: x1,
          y: y1,
          width: x2 - x1,
          height: y2 - y1,
          fill: 'rgba(16, 185, 129, 0.32)',
          stroke: '#10b981',
          strokeWidth: 2.5,
          cornerRadius: 4,
          listening: false,
        })
      );
      addCenteredBadge(
        layer,
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        label,
        '6yd Width → Pen Spot',
        uprightRot,
        {
          fill: 'rgba(6, 78, 59, 0.92)',
          stroke: '#34d399',
          textColor: '#ecfdf5',
          subColor: '#6ee7b7',
          width: 112,
        }
      );
    };
    if (showRight) drawGolden(940, 1050, 'GOLDEN ZONE');
    if (showLeft) drawGolden(0, 110, 'GOLDEN ZONE');
  }

  // C. The Pockets (Half-Space between lines: X: 52.5m-88.5m => 525..885px, Y: 138.4..248.4 & 431.6..541.6)
  if (config.subZones.pockets) {
    const drawPockets = (x1: number, x2: number) => {
      const bands: Array<[number, number, string]> = [
        [138.4, 248.4, 'LHS POCKET'],
        [431.6, 541.6, 'RHS POCKET'],
      ];
      bands.forEach(([y1, y2, title]) => {
        layer.add(
          new Konva.Rect({
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
            fill: 'rgba(56, 189, 248, 0.24)',
            stroke: '#38bdf8',
            strokeWidth: 2,
            dash: [6, 4],
            cornerRadius: 6,
            listening: false,
          })
        );
        addCenteredBadge(
          layer,
          (x1 + x2) / 2,
          (y1 + y2) / 2,
          title,
          'Between the Lines',
          uprightRot,
          {
            fill: 'rgba(12, 74, 110, 0.90)',
            stroke: '#38bdf8',
            textColor: '#e0f2fe',
            subColor: '#7dd3fc',
            width: 108,
          }
        );
      });
    };
    if (showRight) drawPockets(525, 885);
    if (showLeft) drawPockets(165, 525);
  }

  // D. Byline Cutback Zones (X: 88.5m-105m => 885..1050px, Y: 138.4..248.4 & 431.6..541.6)
  if (config.subZones.cutback) {
    const drawCutbacks = (x1: number, x2: number) => {
      const bands: Array<[number, number, string]> = [
        [138.4, 248.4, 'CUTBACK ZONE'],
        [431.6, 541.6, 'CUTBACK ZONE'],
      ];
      bands.forEach(([y1, y2, title]) => {
        layer.add(
          new Konva.Rect({
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
            fill: 'rgba(192, 132, 252, 0.26)',
            stroke: '#c084fc',
            strokeWidth: 2,
            dash: [5, 4],
            cornerRadius: 4,
            listening: false,
          })
        );
        addCenteredBadge(
          layer,
          (x1 + x2) / 2,
          (y1 + y2) / 2,
          title,
          'Byline Low Cross',
          uprightRot,
          {
            fill: 'rgba(88, 28, 135, 0.90)',
            stroke: '#d8b4fe',
            textColor: '#faf5ff',
            subColor: '#e9d5ff',
            width: 104,
          }
        );
      });
    };
    if (showRight) drawCutbacks(885, 1050);
    if (showLeft) drawCutbacks(0, 165);
  }
}
