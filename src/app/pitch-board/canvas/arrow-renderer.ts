import Konva from 'konva';
import {
  ArrowStyle,
  TacticalArrow,
  TacticalShape,
  TacticalEntity,
} from '../models/tactical-board.models';

export const ZONE_RADIUS = 28;

export function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(241, 196, 15, ${alpha})`;
}

/**
 * Computes sampled points along a straight/curved line, adding sine waves for dribbles
 * and trimming the tip for Target Zone arrows.
 */
export function computeArrowPath(
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
    style === 'zone' && rawDist > ZONE_RADIUS + 12
      ? Math.max(0.25, 1 - (ZONE_RADIUS - 2) / rawDist)
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

export function computeTBarPoints(pathPoints: number[]): [number, number, number, number] {
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

export function createShapeNode(
  s: Pick<TacticalShape, 'kind' | 'x1' | 'y1' | 'x2' | 'y2' | 'color'>,
  listening: boolean
): Konva.Shape {
  const x = Math.min(s.x1, s.x2);
  const y = Math.min(s.y1, s.y2);
  const w = Math.abs(s.x2 - s.x1);
  const h = Math.abs(s.y2 - s.y1);
  const fill = hexWithAlpha(s.color, 0.2);
  const common = {
    fill,
    stroke: s.color,
    strokeWidth: 2.5,
    dash: [8, 5],
    listening,
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

export function createArrowGroup(
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
        radius: ZONE_RADIUS,
        fill: hexWithAlpha(color, 0.2),
        stroke: color,
        strokeWidth: 2.5,
        dash: [8, 5],
        listening: interactive,
      }),
      new Konva.Circle({
        name: 'zone-inner',
        x: x2,
        y: y2,
        radius: 5,
        fill: hexWithAlpha(color, 0.55),
        listening: false,
      })
    );
  }

  const pathPoints =
    style === 'freehand' && arrow.pathPoints && arrow.pathPoints.length >= 4
      ? arrow.pathPoints
      : computeArrowPath(arrow.points, style, arrow.controlPoint);

  if (style === 'block') {
    group.add(
      new Konva.Line({
        name: 'arrow-line',
        points: pathPoints,
        stroke: color,
        strokeWidth,
        hitStrokeWidth: 26,
        lineCap: 'round',
        lineJoin: 'round',
        listening: interactive,
      }),
      new Konva.Line({
        name: 'block-tbar',
        points: computeTBarPoints(pathPoints),
        stroke: color,
        strokeWidth: strokeWidth + 1,
        hitStrokeWidth: 26,
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
      hitStrokeWidth: 26,
      dash: style === 'run' || style === 'zone' ? [12, 8] : undefined,
      tension: style === 'dribble' || style === 'freehand' ? 0.35 : 0,
      lineCap: 'round',
      lineJoin: 'round',
      listening: interactive,
    })
  );

  return group;
}

export function updateArrowGroup(
  group: Konva.Group,
  points: [number, number, number, number],
  style: ArrowStyle,
  controlPoint?: [number, number],
  freehandPts?: number[]
): void {
  const pathPts =
    style === 'freehand' && freehandPts && freehandPts.length >= 4
      ? freehandPts
      : computeArrowPath(points, style, controlPoint);
  const line = group.findOne<Konva.Line>('.arrow-line');
  if (line) {
    line.points(pathPts);
  }
  if (style === 'block') {
    const tbar = group.findOne<Konva.Line>('.block-tbar');
    if (tbar) tbar.points(computeTBarPoints(pathPts));
  }
  if (style === 'zone') {
    const [, , x2, y2] = points;
    group.findOne('.zone-outer')?.position({ x: x2, y: y2 });
    group.findOne('.zone-inner')?.position({ x: x2, y: y2 });
  }
}

/**
 * Renders faded previous-frame tokens and dashed movement trails onto `ghostLayer`.
 */
export function renderGhostLayer(
  ghostLayer: Konva.Layer,
  previous: TacticalEntity[] | null,
  current: TacticalEntity[],
  homeColor: string,
  awayColor: string
): void {
  ghostLayer.destroyChildren();
  if (!previous) return;

  previous.forEach((p) => {
    const now = current.find((e) => e.id === p.id);
    if (!now || Math.hypot(now.x - p.x, now.y - p.y) < 4) return;

    const isBall = p.type === 'ball';
    const color =
      p.color ??
      (p.type === 'home' ? homeColor : p.type === 'away' ? awayColor : '#ffffff');

    ghostLayer.add(
      new Konva.Arrow({
        points: [p.x, p.y, now.x, now.y],
        stroke: 'rgba(255, 255, 255, 0.55)',
        fill: 'rgba(255, 255, 255, 0.55)',
        strokeWidth: 2,
        dash: [8, 6],
        pointerLength: 8,
        pointerWidth: 8,
        listening: false,
      }),
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
