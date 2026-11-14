import Konva from 'konva';
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  GOAL_WIDTH,
  GOAL_TOP,
  GOAL_DEPTH,
  PITCH_PAD_X,
  PITCH_PAD_Y,
  FULL_VIEW_W,
  FULL_VIEW_H,
  TacticalEntity,
} from '../models/tactical-board.models';

/**
 * Draws the stadium apron, mowed grass stripes, pitch markings, penalty boxes/arcs,
 * and protruding woven 3D goal nets onto `pitchLayer`.
 */
export function drawPitchSurface(
  pitchLayer: Konva.Layer,
  showStripes: boolean,
  showMarkings: boolean
): void {
  pitchLayer.destroyChildren();
  const W = BASE_WIDTH;
  const H = BASE_HEIGHT;

  // Outer stadium apron / run-off surround (outside the white boundary lines, where goal nets protrude)
  pitchLayer.add(
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
  pitchLayer.add(
    new Konva.Rect({ x: 0, y: 0, width: W, height: H, fill: '#357a38', listening: false })
  );

  // Mowed stadium grass stripes (10 vertical bands)
  if (showStripes) {
    const stripeCount = 10;
    const stripeW = W / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 1) {
        pitchLayer.add(
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

  if (!showMarkings) return;

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
    for (let y = ny + 4.5; y < ny + nh - 2; y += 4.5) {
      netGroup.add(
        new Konva.Line({
          points: [gx, y, gx + nw, y],
          stroke: 'rgba(255, 255, 255, 0.72)',
          strokeWidth: 1.1,
        })
      );
    }
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

  pitchLayer.add(
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

export { drawPitchDivisions } from './pitch-divisions';

/**
 * Highlights the left or right protruding goal net in gold and renders a "⚽ GOAL!" badge
 * when a ball enters the goal mouth.
 */
export function renderGoalScoredOverlay(
  drawingLayer: Konva.Layer,
  entities: TacticalEntity[],
  uprightRot: number
): void {
  const balls = entities.filter((e) => e.type === 'ball');
  const checkGoal = (side: 'left' | 'right') => {
    const scored = balls.some((b) =>
      side === 'left'
        ? b.x <= 12 && b.y >= GOAL_TOP - 4 && b.y <= GOAL_TOP + GOAL_WIDTH + 4
        : b.x >= BASE_WIDTH - 12 && b.y >= GOAL_TOP - 4 && b.y <= GOAL_TOP + GOAL_WIDTH + 4
    );
    if (!scored) return;

    const gx = side === 'left' ? -GOAL_DEPTH : BASE_WIDTH;
    drawingLayer.add(
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

    const badgeX = side === 'left' ? 38 : BASE_WIDTH - 38;
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
    drawingLayer.add(badge);
  };

  checkGoal('left');
  checkGoal('right');
}

/**
 * Adds a classic black-pentagon / white-hexagon football graphic to a Konva Group.
 */
export function addClassicBall(group: Konva.Group, r: number): void {
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
}
