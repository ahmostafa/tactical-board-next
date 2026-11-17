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
  PitchViewMode,
  TacticalEntity,
} from '../models/tactical-board.models';
import { projectPitchPoint } from './perspective-projection';

/**
 * Draws the stadium apron, mowed grass stripes, pitch markings, penalty boxes/arcs,
 * and protruding woven 3D goal nets onto `pitchLayer`.
 */
export function drawPitchSurface(
  pitchLayer: Konva.Layer,
  showStripes: boolean,
  showMarkings: boolean,
  viewMode: PitchViewMode = 'full'
): void {
  if (viewMode === 'perspective') {
    drawPerspectivePitchSurface(pitchLayer, showStripes, showMarkings);
    return;
  }

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

/**
 * Draws the 3D Perspective / Broadcast pitch surface with trapezoidal boundary,
 * logarithmic mowing stripes, perspective-foreshortened center circle & boxes,
 * and protruding 3D goal nets.
 */
export function drawPerspectivePitchSurface(
  pitchLayer: Konva.Layer,
  showStripes: boolean,
  showMarkings: boolean
): void {
  pitchLayer.destroyChildren();

  // 1. Stadium surround / apron (matching olive-green background in broadcast view)
  pitchLayer.add(
    new Konva.Rect({
      x: -PITCH_PAD_X,
      y: -PITCH_PAD_Y,
      width: FULL_VIEW_W,
      height: FULL_VIEW_H,
      fill: '#607449',
      listening: false,
    })
  );

  // 2. In-bounds pitch turf trapezoid
  const pNL = projectPitchPoint(0, 0);
  const pNR = projectPitchPoint(0, BASE_HEIGHT);
  const pFR = projectPitchPoint(BASE_WIDTH, BASE_HEIGHT);
  const pFL = projectPitchPoint(BASE_WIDTH, 0);

  const turfPoly = new Konva.Line({
    points: [pNL.x, pNL.y, pNR.x, pNR.y, pFR.x, pFR.y, pFL.x, pFL.y],
    fill: '#588344',
    closed: true,
    listening: false,
  });
  pitchLayer.add(turfPoly);

  // 3. Alternating horizontal grass bands (10 stripes in perspective)
  if (showStripes) {
    const stripeCount = 10;
    const stripeLen = BASE_WIDTH / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 1) {
        const x1 = i * stripeLen;
        const x2 = (i + 1) * stripeLen;
        const sNL = projectPitchPoint(x1, 0);
        const sNR = projectPitchPoint(x1, BASE_HEIGHT);
        const sFR = projectPitchPoint(x2, BASE_HEIGHT);
        const sFL = projectPitchPoint(x2, 0);

        pitchLayer.add(
          new Konva.Line({
            points: [sNL.x, sNL.y, sNR.x, sNR.y, sFR.x, sFR.y, sFL.x, sFL.y],
            fill: 'rgba(0, 0, 0, 0.085)',
            closed: true,
            listening: false,
          })
        );
      }
    }
  }

  if (!showMarkings) return;

  const lineConfig = { stroke: '#ffffff', strokeWidth: 3.5, listening: false };

  // 4. White boundary lines
  pitchLayer.add(
    new Konva.Line({
      points: [pNL.x, pNL.y, pNR.x, pNR.y, pFR.x, pFR.y, pFL.x, pFL.y],
      closed: true,
      ...lineConfig,
    })
  );

  // 5. Halfway line
  const hwL = projectPitchPoint(BASE_WIDTH / 2, 0);
  const hwR = projectPitchPoint(BASE_WIDTH / 2, BASE_HEIGHT);
  pitchLayer.add(
    new Konva.Line({
      points: [hwL.x, hwL.y, hwR.x, hwR.y],
      ...lineConfig,
    })
  );

  // 6. Center Circle (mathematically exact perspective ellipse)
  const center = projectPitchPoint(BASE_WIDTH / 2, BASE_HEIGHT / 2);
  const circlePoints: number[] = [];
  const radiusMeters = 91.5;
  for (let a = 0; a <= 360; a += 10) {
    const rad = (a * Math.PI) / 180;
    const px = BASE_WIDTH / 2 + Math.cos(rad) * radiusMeters;
    const py = BASE_HEIGHT / 2 + Math.sin(rad) * radiusMeters;
    const proj = projectPitchPoint(px, py);
    circlePoints.push(proj.x, proj.y);
  }
  pitchLayer.add(
    new Konva.Line({
      points: circlePoints,
      closed: true,
      ...lineConfig,
    })
  );

  // Center Spot
  pitchLayer.add(
    new Konva.Circle({
      x: center.x,
      y: center.y,
      radius: 4,
      fill: '#ffffff',
      listening: false,
    })
  );

  // Helper for sampling arcs in perspective
  const drawPerspectiveArc = (
    centerX: number,
    centerY: number,
    radius: number,
    startDeg: number,
    endDeg: number
  ) => {
    const pts: number[] = [];
    const step = (endDeg - startDeg) / 16;
    for (let a = startDeg; a <= endDeg; a += step) {
      const rad = (a * Math.PI) / 180;
      const px = centerX + Math.cos(rad) * radius;
      const py = centerY + Math.sin(rad) * radius;
      const proj = projectPitchPoint(px, py);
      pts.push(proj.x, proj.y);
    }
    return new Konva.Line({ points: pts, ...lineConfig });
  };

  // 7. Near Penalty Area (Bottom / Defending side)
  const nearBoxY1 = (BASE_HEIGHT - 403.2) / 2;
  const nearBoxY2 = (BASE_HEIGHT + 403.2) / 2;
  const bNL = projectPitchPoint(0, nearBoxY1);
  const bNR = projectPitchPoint(0, nearBoxY2);
  const bFL = projectPitchPoint(165, nearBoxY1);
  const bFR = projectPitchPoint(165, nearBoxY2);

  pitchLayer.add(
    new Konva.Line({
      points: [bNL.x, bNL.y, bFL.x, bFL.y, bFR.x, bFR.y, bNR.x, bNR.y],
      ...lineConfig,
    })
  );

  // Near 6-yard Goal Area
  const nearGoalY1 = (BASE_HEIGHT - 183.2) / 2;
  const nearGoalY2 = (BASE_HEIGHT + 183.2) / 2;
  const gNL = projectPitchPoint(0, nearGoalY1);
  const gNR = projectPitchPoint(0, nearGoalY2);
  const gFL = projectPitchPoint(55, nearGoalY1);
  const gFR = projectPitchPoint(55, nearGoalY2);

  pitchLayer.add(
    new Konva.Line({
      points: [gNL.x, gNL.y, gFL.x, gFL.y, gFR.x, gFR.y, gNR.x, gNR.y],
      ...lineConfig,
    })
  );

  // Near Penalty Spot
  const nearSpot = projectPitchPoint(110, BASE_HEIGHT / 2);
  pitchLayer.add(
    new Konva.Circle({
      x: nearSpot.x,
      y: nearSpot.y,
      radius: 4,
      fill: '#ffffff',
      listening: false,
    })
  );

  // Near Penalty Arc (D-arc pointing towards center)
  pitchLayer.add(drawPerspectiveArc(110, BASE_HEIGHT / 2, 91.5, -53, 53));

  // 8. Far Penalty Area (Top / Attacking side)
  const fBoxNL = projectPitchPoint(BASE_WIDTH, nearBoxY1);
  const fBoxNR = projectPitchPoint(BASE_WIDTH, nearBoxY2);
  const fBoxFL = projectPitchPoint(BASE_WIDTH - 165, nearBoxY1);
  const fBoxFR = projectPitchPoint(BASE_WIDTH - 165, nearBoxY2);

  pitchLayer.add(
    new Konva.Line({
      points: [fBoxNL.x, fBoxNL.y, fBoxFL.x, fBoxFL.y, fBoxFR.x, fBoxFR.y, fBoxNR.x, fBoxNR.y],
      ...lineConfig,
    })
  );

  // Far 6-yard Goal Area
  const fGoalNL = projectPitchPoint(BASE_WIDTH, nearGoalY1);
  const fGoalNR = projectPitchPoint(BASE_WIDTH, nearGoalY2);
  const fGoalFL = projectPitchPoint(BASE_WIDTH - 55, nearGoalY1);
  const fGoalFR = projectPitchPoint(BASE_WIDTH - 55, nearGoalY2);

  pitchLayer.add(
    new Konva.Line({
      points: [fGoalNL.x, fGoalNL.y, fGoalFL.x, fGoalFL.y, fGoalFR.x, fGoalFR.y, fGoalNR.x, fGoalNR.y],
      ...lineConfig,
    })
  );

  // Far Penalty Spot
  const farSpot = projectPitchPoint(BASE_WIDTH - 110, BASE_HEIGHT / 2);
  pitchLayer.add(
    new Konva.Circle({
      x: farSpot.x,
      y: farSpot.y,
      radius: 3.5,
      fill: '#ffffff',
      listening: false,
    })
  );

  // Far Penalty Arc (D-arc pointing towards center)
  pitchLayer.add(drawPerspectiveArc(BASE_WIDTH - 110, BASE_HEIGHT / 2, 91.5, 127, 233));

  // 9. 3D Protruding Goal Nets
  // Near Goal Net (protrudes downwards into foreground)
  const nearPost1 = projectPitchPoint(0, GOAL_TOP);
  const nearPost2 = projectPitchPoint(0, GOAL_TOP + GOAL_WIDTH);
  const netNearGroup = new Konva.Group({ listening: false });
  const netNearDepth = 48;

  netNearGroup.add(
    new Konva.Rect({
      x: nearPost1.x,
      y: nearPost1.y,
      width: nearPost2.x - nearPost1.x,
      height: netNearDepth,
      fill: 'rgba(255, 255, 255, 0.08)',
      stroke: '#ffffff',
      strokeWidth: 3,
    })
  );

  for (let y = nearPost1.y + 6; y < nearPost1.y + netNearDepth; y += 6) {
    netNearGroup.add(
      new Konva.Line({
        points: [nearPost1.x, y, nearPost2.x, y],
        stroke: 'rgba(255, 255, 255, 0.65)',
        strokeWidth: 1.1,
      })
    );
  }
  for (let x = nearPost1.x + 8; x < nearPost2.x; x += 8) {
    netNearGroup.add(
      new Konva.Line({
        points: [x, nearPost1.y, x, nearPost1.y + netNearDepth],
        stroke: 'rgba(255, 255, 255, 0.55)',
        strokeWidth: 1,
      })
    );
  }
  pitchLayer.add(netNearGroup);

  // Far Goal Net (protrudes upwards towards background)
  const farPost1 = projectPitchPoint(BASE_WIDTH, GOAL_TOP);
  const farPost2 = projectPitchPoint(BASE_WIDTH, GOAL_TOP + GOAL_WIDTH);
  const netFarGroup = new Konva.Group({ listening: false });
  const netFarDepth = 26;

  netFarGroup.add(
    new Konva.Rect({
      x: farPost1.x,
      y: farPost1.y - netFarDepth,
      width: farPost2.x - farPost1.x,
      height: netFarDepth,
      fill: 'rgba(255, 255, 255, 0.08)',
      stroke: '#ffffff',
      strokeWidth: 2.5,
    })
  );

  for (let y = farPost1.y - netFarDepth + 4.5; y < farPost1.y; y += 4.5) {
    netFarGroup.add(
      new Konva.Line({
        points: [farPost1.x, y, farPost2.x, y],
        stroke: 'rgba(255, 255, 255, 0.6)',
        strokeWidth: 0.9,
      })
    );
  }
  for (let x = farPost1.x + 5; x < farPost2.x; x += 5) {
    netFarGroup.add(
      new Konva.Line({
        points: [x, farPost1.y - netFarDepth, x, farPost1.y],
        stroke: 'rgba(255, 255, 255, 0.5)',
        strokeWidth: 0.9,
      })
    );
  }
  pitchLayer.add(netFarGroup);
}

export { drawPitchDivisions } from './pitch-divisions';

/**
 * Highlights the left or right protruding goal net in gold and renders a "⚽ GOAL!" badge
 * when a ball enters the goal mouth.
 */
export function renderGoalScoredOverlay(
  drawingLayer: Konva.Layer,
  entities: TacticalEntity[],
  uprightRot: number,
  viewMode: PitchViewMode = 'full'
): void {
  const balls = entities.filter((e) => e.type === 'ball');
  const isPerspective = viewMode === 'perspective';

  const checkGoal = (side: 'left' | 'right') => {
    const scored = balls.some((b) =>
      side === 'left'
        ? b.x <= 16 && b.y >= GOAL_TOP - 8 && b.y <= GOAL_TOP + GOAL_WIDTH + 8
        : b.x >= BASE_WIDTH - 16 && b.y >= GOAL_TOP - 8 && b.y <= GOAL_TOP + GOAL_WIDTH + 8
    );
    if (!scored) return;

    let gx: number;
    let gy: number;
    let gw: number;
    let gh: number;
    let badgeX: number;
    let badgeY: number;

    if (isPerspective) {
      if (side === 'left') {
        // Near goal (bottom of screen)
        const p1 = projectPitchPoint(0, GOAL_TOP);
        const p2 = projectPitchPoint(0, GOAL_TOP + GOAL_WIDTH);
        gx = p1.x;
        gy = p1.y;
        gw = p2.x - p1.x;
        gh = 48;
        badgeX = (p1.x + p2.x) / 2;
        badgeY = p1.y - 20;
      } else {
        // Far goal (top of screen)
        const p1 = projectPitchPoint(BASE_WIDTH, GOAL_TOP);
        const p2 = projectPitchPoint(BASE_WIDTH, GOAL_TOP + GOAL_WIDTH);
        gx = p1.x;
        gy = p1.y - 26;
        gw = p2.x - p1.x;
        gh = 26;
        badgeX = (p1.x + p2.x) / 2;
        badgeY = p1.y + 22;
      }
    } else {
      gx = side === 'left' ? -GOAL_DEPTH : BASE_WIDTH;
      gy = GOAL_TOP;
      gw = GOAL_DEPTH;
      gh = GOAL_WIDTH;
      badgeX = side === 'left' ? 38 : BASE_WIDTH - 38;
      badgeY = GOAL_TOP - 18;
    }

    drawingLayer.add(
      new Konva.Rect({
        x: gx,
        y: gy,
        width: gw,
        height: gh,
        fill: 'rgba(250, 204, 21, 0.42)',
        stroke: '#facc15',
        strokeWidth: 3,
        listening: false,
      })
    );

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
