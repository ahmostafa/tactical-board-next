import Konva from 'konva';
import { EquipmentKind } from './board.store';

export interface EquipmentCatalogItem {
  kind: EquipmentKind;
  label: string;
  defaultColor: string;
}

export const EQUIPMENT_CATALOG: EquipmentCatalogItem[] = [
  { kind: 'cone', label: 'Cone', defaultColor: '#f97316' },
  { kind: 'disc', label: 'Marker Disc', defaultColor: '#eab308' },
  { kind: 'hurdle', label: 'Hurdle', defaultColor: '#facc15' },
  { kind: 'ladder', label: 'Agility Ladder', defaultColor: '#facc15' },
  { kind: 'pole', label: 'Slalom Pole', defaultColor: '#f97316' },
  { kind: 'mannequin', label: 'Mannequin Wall', defaultColor: '#f59e0b' },
  { kind: 'ring', label: 'Training Ring', defaultColor: '#38bdf8' },
  { kind: 'minigoal', label: 'Mini-Goal', defaultColor: '#ffffff' },
];

export function renderEquipmentShape(group: Konva.Group, kind: EquipmentKind, color = '#f97316') {
  switch (kind) {
    case 'cone': {
      // Square base + triangular cone body + white top tip
      group.add(
        new Konva.Rect({
          x: -11,
          y: 4,
          width: 22,
          height: 6,
          cornerRadius: 2,
          fill: color,
          stroke: '#111827',
          strokeWidth: 1.2,
        }),
        new Konva.Line({
          points: [-9, 7, 0, -12, 9, 7],
          closed: true,
          fill: color,
          stroke: '#111827',
          strokeWidth: 1.2,
          lineJoin: 'round',
        }),
        new Konva.Line({
          points: [-4.5, -2, 4.5, -2, 3, -6, -3, -6],
          closed: true,
          fill: '#ffffff',
          listening: false,
        })
      );
      break;
    }
    case 'disc':
    case 'donut': {
      group.add(
        new Konva.Circle({
          radius: 10,
          fill: color,
          stroke: '#111827',
          strokeWidth: 1.2,
        }),
        new Konva.Circle({
          radius: 4,
          fill: '#2e7d32',
          stroke: '#111827',
          strokeWidth: 1,
        })
      );
      break;
    }
    case 'hurdle': {
      group.add(
        new Konva.Line({
          points: [-16, 6, -12, -6, 12, -6, 16, 6],
          stroke: color,
          strokeWidth: 3.5,
          lineCap: 'round',
          lineJoin: 'round',
        }),
        new Konva.Line({
          points: [-12, -6, 12, -6],
          stroke: '#111827',
          strokeWidth: 1.2,
          dash: [4, 4],
        })
      );
      break;
    }
    case 'ladder': {
      const w = 18;
      const h = 56;
      group.add(
        // Hit area so dragging between rungs is effortless
        new Konva.Rect({ x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(0,0,0,0.01)' }),
        new Konva.Line({ points: [-w / 2, -h / 2, -w / 2, h / 2], stroke: '#ef4444', strokeWidth: 2.5 }),
        new Konva.Line({ points: [w / 2, -h / 2, w / 2, h / 2], stroke: '#ef4444', strokeWidth: 2.5 })
      );
      for (let y = -h / 2 + 7; y <= h / 2 - 7; y += 10) {
        group.add(new Konva.Line({ points: [-w / 2, y, w / 2, y], stroke: color, strokeWidth: 2.5 }));
      }
      break;
    }
    case 'pole': {
      group.add(
        new Konva.Circle({ x: 0, y: 12, radius: 5, fill: '#111827' }),
        new Konva.Line({
          points: [0, 12, 0, -16],
          stroke: color,
          strokeWidth: 3.5,
          lineCap: 'round',
        }),
        new Konva.Circle({ x: 0, y: -16, radius: 3, fill: '#ffffff', stroke: '#111827', strokeWidth: 1 })
      );
      break;
    }
    case 'mannequin': {
      // Free-kick defensive dummy: head + torso + spikes base
      group.add(
        new Konva.Circle({ x: 0, y: -13, radius: 5.5, fill: color, stroke: '#111827', strokeWidth: 1.3 }),
        new Konva.Rect({
          x: -11,
          y: -7,
          width: 22,
          height: 18,
          cornerRadius: [6, 6, 2, 2],
          fill: color,
          stroke: '#111827',
          strokeWidth: 1.3,
        }),
        new Konva.Line({ points: [-6, 11, -6, 16], stroke: '#e5e7eb', strokeWidth: 2 }),
        new Konva.Line({ points: [6, 11, 6, 16], stroke: '#e5e7eb', strokeWidth: 2 })
      );
      break;
    }
    case 'ring': {
      group.add(
        new Konva.Circle({
          radius: 14,
          fill: 'rgba(56, 189, 248, 0.08)',
          stroke: color,
          strokeWidth: 3,
        })
      );
      break;
    }
    case 'minigoal': {
      // Portable mini-goal facing right by default (rotatable by 45 deg increments)
      const gw = 22;
      const gh = 54;
      group.add(
        new Konva.Rect({
          x: -gw / 2,
          y: -gh / 2,
          width: gw,
          height: gh,
          fill: 'rgba(255, 255, 255, 0.16)',
          stroke: color,
          strokeWidth: 2.5,
          cornerRadius: 2,
        })
      );
      // Net mesh lines
      for (let y = -gh / 2 + 9; y < gh / 2; y += 9) {
        group.add(
          new Konva.Line({
            points: [-gw / 2, y, gw / 2, y],
            stroke: 'rgba(255,255,255,0.35)',
            strokeWidth: 1,
            listening: false,
          })
        );
      }
      break;
    }
  }
}
