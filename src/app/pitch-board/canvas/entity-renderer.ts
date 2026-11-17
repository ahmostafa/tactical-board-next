import Konva from 'konva';
import {
  ActiveToolMode,
  BASE_HEIGHT,
  BASE_WIDTH,
  CURSORS,
  PitchViewMode,
  TacticalEntity,
  TacticalText,
} from '../models/tactical-board.models';
import { PITCH_ALIGNED_EQUIPMENT, renderEquipmentShape } from '../equipment-renderer';
import { addClassicBall } from './pitch-renderer';
import { projectPitchPoint, unprojectPitchPoint } from './perspective-projection';

export interface EntityRenderCallbacks {
  activeTool: () => ActiveToolMode;
  isPlaying: () => boolean;
  isExporting: () => boolean;
  uprightRotation: () => number;
  pitchView?: () => PitchViewMode;
  selectedEntityId: () => string | null;
  homeColor: () => string;
  awayColor: () => string;
  defaultToolCursor: () => string;
  setStageCursor: (cursor: string) => void;
  clampStageDragPos: (
    pos: { x: number; y: number },
    margin: number,
    allowGoalNet?: boolean
  ) => { x: number; y: number };
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onRemoveEntity: (id: string) => void;
  onSelectEntity: (id: string) => void;
  onUpdateEntityMeta?: (id: string, patch: Partial<TacticalEntity>) => void;
}

export interface TextRenderCallbacks {
  activeTool: () => ActiveToolMode;
  isPlaying: () => boolean;
  isExporting: () => boolean;
  uprightRotation: () => number;
  pitchView: () => PitchViewMode;
  defaultToolCursor: () => string;
  setStageCursor: (cursor: string) => void;
  clampStageDragPos: (pos: { x: number; y: number }, margin: number) => { x: number; y: number };
  onRemoveText: (id: string) => void;
  onUpdateTextPosition: (id: string, x: number, y: number) => void;
}

/**
 * Renders the top frame coaching note banner and draggable/erasable text labels onto the drawing layer.
 */
export function renderTextsOnLayer(
  drawingLayer: Konva.Layer,
  texts: TacticalText[],
  frameNote: string,
  cb: TextRenderCallbacks
): void {
  const uprightRot = cb.uprightRotation();
  if (frameNote.trim()) {
    const view = cb.pitchView();
    const maxBannerW = view === 'half-left' || view === 'half-right' ? 495 : 580;
    const bannerWidth = Math.min(maxBannerW, Math.max(220, frameNote.length * 8.2 + 28));
    const isVert = view === 'vertical';
    const centerX =
      view === 'half-left' ? 262.5 : view === 'half-right' ? 787.5 : BASE_WIDTH / 2;
    const bx = isVert ? 26 : centerX - bannerWidth / 2;
    const by = isVert ? BASE_HEIGHT / 2 : 12;
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
        fontSize: 13,
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        fill: '#fef08a',
        align: 'center',
        verticalAlign: 'middle',
      })
    );
    drawingLayer.add(noteGroup);
  }

  const canDrag = cb.activeTool() === 'move' && !cb.isPlaying() && !cb.isExporting();
  const canErase = cb.activeTool() === 'eraser';
  texts.forEach((t) => {
    const textGroup = new Konva.Group({
      x: t.x,
      y: t.y,
      rotation: uprightRot,
      draggable: canDrag,
      listening: canDrag || canErase,
      dragBoundFunc: (pos) => cb.clampStageDragPos(pos, 15),
    });
    const padX = 8;
    const padY = 4;
    const w = Math.max(40, t.text.length * (t.fontSize * 0.58) + padX * 2);
    const h = t.fontSize + padY * 2;
    const txt = new Konva.Text({
      x: -w / 2,
      y: -h / 2,
      width: w,
      height: h,
      text: t.text,
      fontSize: t.fontSize,
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      fill: t.color,
      align: 'center',
      verticalAlign: 'middle',
    });
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
      if (cb.activeTool() === 'eraser') {
        cb.setStageCursor(CURSORS.eraserHot);
      } else if (canDrag) {
        cb.setStageCursor('grab');
      }
    });
    textGroup.on('mouseleave', () => cb.setStageCursor(cb.defaultToolCursor()));
    textGroup.on('dragstart', () => cb.setStageCursor('grabbing'));
    textGroup.on('click tap', (e) => {
      if (cb.activeTool() === 'eraser') {
        e.cancelBubble = true;
        cb.onRemoveText(t.id);
        cb.setStageCursor(cb.defaultToolCursor());
      }
    });
    textGroup.on('dragend', () => {
      cb.setStageCursor('grab');
      const p = textGroup.position();
      cb.onUpdateTextPosition(t.id, Math.round(p.x), Math.round(p.y));
    });
    drawingLayer.add(textGroup);
  });
}

/**
 * Synchronizes player tokens, footballs, referees, and training equipment on the entity layer.
 */
export function syncEntityNodes(
  entityLayer: Konva.Layer,
  entities: TacticalEntity[],
  cb: EntityRenderCallbacks
): void {
  const wantedIds = new Set(entities.map((e) => e.id));

  entityLayer
    .getChildren()
    .slice()
    .forEach((child) => {
      if (!wantedIds.has(child.id())) child.destroy();
    });

  const isMove = cb.activeTool() === 'move' && !cb.isPlaying() && !cb.isExporting();
  const isEraser = cb.activeTool() === 'eraser' && !cb.isPlaying() && !cb.isExporting();
  const uprightRot = cb.uprightRotation();
  entityLayer.listening(isMove || isEraser);

  entities.forEach((entity) => {
    let group = entityLayer.findOne<Konva.Group>('#' + entity.id);
    const isBall = entity.type === 'ball';
    const isEquip = entity.type === 'equipment';
    const radius = isBall ? 13 : 15;

    if (!group) {
      group = new Konva.Group({
        id: entity.id,
        x: entity.x,
        y: entity.y,
        draggable: isMove,
        dragBoundFunc: (pos) => cb.clampStageDragPos(pos, radius, isBall),
      });

      group.on('mouseenter', () => {
        if (cb.activeTool() === 'eraser' && entity.id !== 'ball') {
          cb.setStageCursor(CURSORS.eraserHot);
        } else if (cb.activeTool() === 'move' && !cb.isPlaying() && !cb.isExporting()) {
          cb.setStageCursor('grab');
        }
      });

      group.on('mouseleave', () => cb.setStageCursor(cb.defaultToolCursor()));
      group.on('dragstart', () => cb.setStageCursor('grabbing'));
      group.on('dragend', () => {
        cb.setStageCursor('grab');
        const newPos = group!.position();
        if (cb.pitchView?.() === 'perspective') {
          const unproj = unprojectPitchPoint(newPos.x, newPos.y);
          cb.onUpdatePosition(entity.id, unproj.x, unproj.y);
        } else {
          cb.onUpdatePosition(entity.id, Math.round(newPos.x), Math.round(newPos.y));
        }
      });

      group.on('click tap contextmenu', (e) => {
        e.evt?.preventDefault?.();
        if (cb.activeTool() === 'eraser') {
          if (entity.id !== 'ball') {
            e.cancelBubble = true;
            cb.onRemoveEntity(entity.id);
            cb.setStageCursor(cb.defaultToolCursor());
          }
          return;
        }
        if (cb.activeTool() === 'move') {
          e.cancelBubble = true;
          cb.onSelectEntity(entity.id);
        }
      });

      entityLayer.add(group);
    }

    const isPerspective = cb.pitchView?.() === 'perspective';
    const screenCoord = isPerspective
      ? projectPitchPoint(entity.x, entity.y)
      : { x: entity.x, y: entity.y, scale: 1 };

    group.position({ x: screenCoord.x, y: screenCoord.y });
    group.scale({ x: screenCoord.scale, y: screenCoord.scale });
    if (isEquip) {
      const isPitchAligned =
        entity.equipmentKind && PITCH_ALIGNED_EQUIPMENT.has(entity.equipmentKind);
      group.rotation((isPitchAligned ? 0 : uprightRot) + (entity.rotation ?? 0));
    } else {
      group.rotation(0);
    }
    group.draggable(isMove);
    group.destroyChildren();

    if (cb.selectedEntityId() === entity.id && !cb.isPlaying() && !cb.isExporting()) {
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

    if (!isBall && !isEquip && entity.showVision) {
      const facing = entity.facing ?? (entity.type === 'away' ? 180 : 0);
      const isSelected = cb.selectedEntityId() === entity.id;
      const canInteract = isMove && !cb.isPlaying() && !cb.isExporting();

      const wedge = new Konva.Wedge({
        radius: 56,
        angle: 64,
        rotation: facing - 32,
        fill: 'rgba(250, 204, 21, 0.22)',
        stroke: 'rgba(250, 204, 21, 0.55)',
        strokeWidth: 1,
        listening: canInteract,
      });
      group.add(wedge);

      if (canInteract && isSelected) {
        const handleRadius = 58;
        const rad = (facing * Math.PI) / 180;
        const hx = Math.cos(rad) * handleRadius;
        const hy = Math.sin(rad) * handleRadius;

        const guideLine = new Konva.Line({
          points: [0, 0, hx, hy],
          stroke: 'rgba(250, 204, 21, 0.6)',
          strokeWidth: 1,
          dash: [3, 3],
          listening: false,
        });
        group.add(guideLine);

        const handleGroup = new Konva.Group({
          x: hx,
          y: hy,
          listening: true,
        });

        const handleCircle = new Konva.Circle({
          radius: 7,
          fill: '#ffffff',
          stroke: '#eab308',
          strokeWidth: 2,
          shadowColor: 'rgba(0, 0, 0, 0.35)',
          shadowBlur: 3,
          shadowOffset: { x: 0, y: 1 },
        });

        const handlePip = new Konva.Circle({
          radius: 2.5,
          fill: '#d97706',
          listening: false,
        });

        handleGroup.add(handleCircle);
        handleGroup.add(handlePip);
        group.add(handleGroup);

        const angleBadge = new Konva.Label({
          x: hx + 10,
          y: hy - 12,
          visible: false,
          listening: false,
        });
        angleBadge.add(
          new Konva.Tag({
            fill: 'rgba(17, 24, 39, 0.88)',
            stroke: '#fbbf24',
            strokeWidth: 1,
            cornerRadius: 4,
            pointerDirection: 'none',
          })
        );
        const angleText = new Konva.Text({
          text: `${facing}°`,
          fontSize: 11,
          fontFamily: 'sans-serif',
          fontStyle: 'bold',
          fill: '#fef08a',
          padding: 3,
        });
        angleBadge.add(angleText);
        group.add(angleBadge);

        const startVisionRotation = (evt: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
          evt.cancelBubble = true;
          const stage = group.getStage();
          if (!stage) return;

          cb.setStageCursor('crosshair');
          let currentFacing = facing;

          const moveHandler = (moveEvt: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
            const stagePos = stage.getPointerPosition();
            if (!stagePos) return;

            const transform = group.getAbsoluteTransform().copy().invert();
            const localPos = transform.point(stagePos);

            let deg = Math.round((Math.atan2(localPos.y, localPos.x) * 180) / Math.PI);
            if (deg < 0) deg += 360;

            if (moveEvt.evt && (moveEvt.evt as MouseEvent).shiftKey) {
              deg = Math.round(deg / 15) * 15;
              if (deg >= 360) deg = 0;
            }

            currentFacing = deg;

            wedge.rotation(deg - 32);
            const curRad = (deg * Math.PI) / 180;
            const curHx = Math.cos(curRad) * handleRadius;
            const curHy = Math.sin(curRad) * handleRadius;

            handleGroup.position({ x: curHx, y: curHy });
            guideLine.points([0, 0, curHx, curHy]);

            angleText.text(`${deg}°`);
            angleBadge.position({ x: curHx + 10, y: curHy - 12 });
            angleBadge.visible(true);

            entityLayer.batchDraw();
          };

          const upHandler = () => {
            stage.off('pointermove.rotateVision touchmove.rotateVision');
            stage.off('pointerup.rotateVision touchend.rotateVision');
            cb.setStageCursor(cb.defaultToolCursor());

            angleBadge.visible(false);
            entityLayer.batchDraw();

            if (currentFacing !== facing) {
              cb.onUpdateEntityMeta?.(entity.id, { facing: currentFacing });
            }
          };

          stage.on('pointermove.rotateVision touchmove.rotateVision', moveHandler);
          stage.on('pointerup.rotateVision touchend.rotateVision', upHandler);
        };

        handleGroup.on('pointerenter', () => cb.setStageCursor('crosshair'));
        handleGroup.on('pointerleave', () => cb.setStageCursor(cb.defaultToolCursor()));
        handleGroup.on('pointerdown mousedown touchstart', startVisionRotation);

        wedge.on('pointerenter', () => cb.setStageCursor('crosshair'));
        wedge.on('pointerleave', () => cb.setStageCursor(cb.defaultToolCursor()));
        wedge.on('pointerdown mousedown touchstart', startVisionRotation);
      } else if (canInteract && !isSelected) {
        wedge.on('pointerenter', () => cb.setStageCursor('pointer'));
        wedge.on('pointerleave', () => cb.setStageCursor(cb.defaultToolCursor()));
        wedge.on('click tap', (e) => {
          e.cancelBubble = true;
          cb.onSelectEntity(entity.id);
        });
      }
    }

    if (isBall) {
      addClassicBall(group, radius);
    } else if (isEquip && entity.equipmentKind) {
      renderEquipmentShape(group, entity.equipmentKind, entity.color ?? '#f97316');
    } else {
      const fill =
        entity.color ??
        (entity.type === 'home'
          ? cb.homeColor()
          : entity.type === 'away'
            ? cb.awayColor()
            : '#eab308');
      group.add(
        new Konva.Circle({
          radius,
          fill,
          stroke: '#ffffff',
          strokeWidth: 2,
        })
      );
    }

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
