import {
  ArrowStyle,
  EquipmentKind,
  ShapeKind,
  Snapshot,
  TacticalArrow,
  TacticalEntity,
  TacticalShape,
  TacticalText,
} from '../models/tactical-board.models';

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const isArrowStyle = (v: unknown): v is ArrowStyle =>
  v === 'pass' || v === 'run' || v === 'dribble' || v === 'zone' || v === 'block' || v === 'freehand';

const isShapeKind = (v: unknown): v is ShapeKind =>
  v === 'rect' || v === 'ellipse' || v === 'triangle';

const isEntityType = (v: unknown): v is TacticalEntity['type'] =>
  v === 'home' || v === 'away' || v === 'ball' || v === 'referee' || v === 'equipment';

/**
 * Rebuilds a frame from untrusted JSON data, keeping known players, custom tokens/equipment,
 * arrows, shapes, and texts while stripping malformed properties.
 */
export function sanitizeFrame(raw: any, defaultEntities: TacticalEntity[]): Snapshot {
  const defaultById = new Map(defaultEntities.map((e) => [e.id, e]));
  const entities: TacticalEntity[] = Array.isArray(raw?.entities)
    ? raw.entities
        .map((e: any): TacticalEntity | null => {
          if (typeof e?.id !== 'string' || !isNum(e.x) || !isNum(e.y)) return null;
          const fallback = defaultById.get(e.id);
          const type = isEntityType(e.type) ? e.type : fallback?.type;
          if (!type) return null;
          return {
            ...(fallback ?? {}),
            id: e.id,
            type,
            x: e.x,
            y: e.y,
            ...(typeof e.label === 'string' ? { label: e.label.slice(0, 4) } : {}),
            ...(typeof e.name === 'string' ? { name: e.name.slice(0, 24) } : {}),
            ...(typeof e.color === 'string' ? { color: e.color } : {}),
            ...(isNum(e.facing) ? { facing: e.facing } : {}),
            ...(typeof e.showVision === 'boolean' ? { showVision: e.showVision } : {}),
            ...(typeof e.equipmentKind === 'string' ? { equipmentKind: e.equipmentKind as EquipmentKind } : {}),
            ...(isNum(e.rotation) ? { rotation: e.rotation } : {}),
          };
        })
        .filter((e: TacticalEntity | null): e is TacticalEntity => e !== null)
    : defaultEntities;

  return {
    entities,
    arrows: (Array.isArray(raw?.arrows) ? raw.arrows : [])
      .filter(
        (a: any) =>
          typeof a?.id === 'string' &&
          Array.isArray(a.points) &&
          a.points.length === 4 &&
          a.points.every(isNum)
      )
      .map((a: any): TacticalArrow => ({
        id: a.id,
        points: [a.points[0], a.points[1], a.points[2], a.points[3]],
        style: isArrowStyle(a.style) ? a.style : 'pass',
        ...(Array.isArray(a.controlPoint) &&
        a.controlPoint.length === 2 &&
        a.controlPoint.every(isNum)
          ? { controlPoint: [a.controlPoint[0], a.controlPoint[1]] }
          : {}),
        ...(typeof a.color === 'string' ? { color: a.color } : {}),
        ...(isNum(a.strokeWidth) ? { strokeWidth: a.strokeWidth } : {}),
        ...(Array.isArray(a.pathPoints) && a.pathPoints.every(isNum)
          ? { pathPoints: a.pathPoints }
          : {}),
      })),
    shapes: (Array.isArray(raw?.shapes) ? raw.shapes : [])
      .filter(
        (s: any) =>
          typeof s?.id === 'string' &&
          isShapeKind(s.kind) &&
          isNum(s.x1) &&
          isNum(s.y1) &&
          isNum(s.x2) &&
          isNum(s.y2)
      )
      .map((s: any): TacticalShape => ({
        id: s.id,
        kind: s.kind,
        x1: s.x1,
        y1: s.y1,
        x2: s.x2,
        y2: s.y2,
        color: typeof s.color === 'string' ? s.color : '#fbbf24',
      })),
    texts: (Array.isArray(raw?.texts) ? raw.texts : [])
      .filter((t: any) => typeof t?.id === 'string' && isNum(t.x) && isNum(t.y) && typeof t.text === 'string')
      .map((t: any): TacticalText => ({
        id: t.id,
        x: t.x,
        y: t.y,
        text: t.text.slice(0, 80),
        fontSize: isNum(t.fontSize) ? t.fontSize : 18,
        color: typeof t.color === 'string' ? t.color : '#ffffff',
      })),
    note: typeof raw?.note === 'string' ? raw.note.slice(0, 140) : '',
  };
}
