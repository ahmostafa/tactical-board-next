import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { FormationName, getFormationEntities } from './formations.data';

export type EquipmentKind =
  | 'cone'
  | 'disc'
  | 'donut'
  | 'hurdle'
  | 'ladder'
  | 'pole'
  | 'mannequin'
  | 'ring'
  | 'minigoal';

export interface TacticalEntity {
  id: string;
  type: 'home' | 'away' | 'ball' | 'referee' | 'equipment';
  x: number;
  y: number;
  label?: string;
  name?: string;
  color?: string;
  facing?: number;
  showVision?: boolean;
  equipmentKind?: EquipmentKind;
  rotation?: number;
}

export type ArrowStyle = 'pass' | 'run' | 'dribble' | 'zone' | 'block' | 'freehand';

export interface TacticalArrow {
  id: string;
  points: [number, number, number, number];
  style?: ArrowStyle;
  controlPoint?: [number, number];
  color?: string;
  strokeWidth?: number;
  pathPoints?: number[];
}

export type ShapeKind = 'rect' | 'ellipse' | 'triangle';

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
  fontSize: number;
  color: string;
}

export interface Snapshot {
  entities: TacticalEntity[];
  arrows: TacticalArrow[];
  shapes?: TacticalShape[];
  texts?: TacticalText[];
  note?: string;
}

const MAX_HISTORY = 100;

export const INITIAL_ENTITIES: TacticalEntity[] = [
  ...getFormationEntities('home', '4-3-3'),
  ...getFormationEntities('away', '4-2-3-1'),
  { id: 'ball', type: 'ball', x: 525, y: 340 },
];

const initialState = {
  entities: INITIAL_ENTITIES,
  arrows: [] as TacticalArrow[],
  shapes: [] as TacticalShape[],
  texts: [] as TacticalText[],
  note: '',
  homeFormation: '4-3-3' as FormationName,
  awayFormation: '4-2-3-1' as FormationName,
  homeColor: '#e74c3c',
  awayColor: '#3498db',
  frames: [
    {
      entities: INITIAL_ENTITIES,
      arrows: [] as TacticalArrow[],
      shapes: [] as TacticalShape[],
      texts: [] as TacticalText[],
      note: '',
    },
  ] as Snapshot[],
  currentFrame: 0,
  stepDurationMs: 1000,
  past: [] as Snapshot[],
  future: [] as Snapshot[],
};

type State = typeof initialState;

const MAX_FRAMES = 50;
const MIN_STEP_MS = 200;
const MAX_STEP_MS = 5000;

const snapshotOf = (s: Snapshot): Snapshot => ({
  entities: s.entities,
  arrows: s.arrows,
  shapes: s.shapes ?? [],
  texts: s.texts ?? [],
  note: s.note ?? '',
});

const setFrame = (frames: Snapshot[], index: number, snap: Snapshot) =>
  frames.map((f, i) => (i === index ? snap : f));

const withHistory = (state: State, changes: Partial<Snapshot>): Partial<State> => {
  const next: Snapshot = {
    entities: changes.entities ?? state.entities,
    arrows: changes.arrows ?? state.arrows,
    shapes: changes.shapes ?? state.shapes,
    texts: changes.texts ?? state.texts,
    note: changes.note ?? state.note,
  };
  return {
    ...next,
    frames: setFrame(state.frames, state.currentFrame, next),
    past: [...state.past, snapshotOf(state)].slice(-MAX_HISTORY),
    future: [],
  };
};

const showFrame = (frames: Snapshot[], index: number): Partial<State> => ({
  frames,
  currentFrame: index,
  entities: frames[index].entities,
  arrows: frames[index].arrows,
  shapes: frames[index].shapes ?? [],
  texts: frames[index].texts ?? [],
  note: frames[index].note ?? '',
  past: [],
  future: [],
});

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clampStep = (ms: number) => Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, Math.round(ms)));

const isArrowStyle = (v: unknown): v is ArrowStyle =>
  v === 'pass' || v === 'run' || v === 'dribble' || v === 'zone' || v === 'block' || v === 'freehand';

const isShapeKind = (v: unknown): v is ShapeKind =>
  v === 'rect' || v === 'ellipse' || v === 'triangle';

const isEntityType = (v: unknown): v is TacticalEntity['type'] =>
  v === 'home' || v === 'away' || v === 'ball' || v === 'referee' || v === 'equipment';

/** Rebuilds a frame from untrusted data, keeping known players, custom tokens/equipment, arrows, shapes and texts. */
const sanitizeFrame = (raw: any): Snapshot => {
  const rawEntities = Array.isArray(raw?.entities) ? raw.entities : [];
  const savedById = new Map<string, any>();
  const extraEntities: TacticalEntity[] = [];
  const defaultIds = new Set(INITIAL_ENTITIES.map((e) => e.id));

  rawEntities.forEach((e: any) => {
    if (typeof e?.id !== 'string' || !isNum(e.x) || !isNum(e.y)) return;
    const meta: Partial<TacticalEntity> = {
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
    if (defaultIds.has(e.id)) {
      savedById.set(e.id, meta);
    } else if (isEntityType(e.type)) {
      extraEntities.push({ id: e.id, type: e.type, x: e.x, y: e.y, ...meta });
    }
  });

  // If the save explicitly removed some default players (e.g. small-sided drill), respect rawEntities when non-empty
  const baseEntities =
    rawEntities.length > 0 && raw?.allowPartialSquad
      ? INITIAL_ENTITIES.filter((e) => savedById.has(e.id)).map((e) => ({ ...e, ...savedById.get(e.id) }))
      : INITIAL_ENTITIES.map((e) => ({ ...e, ...(savedById.get(e.id) ?? {}) }));

  return {
    entities: [...baseEntities, ...extraEntities],
    arrows: (Array.isArray(raw?.arrows) ? raw.arrows : [])
      .filter((a: any) => typeof a?.id === 'string' && Array.isArray(a.points) && a.points.length === 4 && a.points.every(isNum))
      .map((a: any): TacticalArrow => ({
        id: a.id,
        points: [a.points[0], a.points[1], a.points[2], a.points[3]],
        style: isArrowStyle(a.style) ? a.style : 'pass',
        ...(Array.isArray(a.controlPoint) && a.controlPoint.length === 2 && a.controlPoint.every(isNum)
          ? { controlPoint: [a.controlPoint[0], a.controlPoint[1]] }
          : {}),
        ...(typeof a.color === 'string' ? { color: a.color } : {}),
        ...(isNum(a.strokeWidth) ? { strokeWidth: a.strokeWidth } : {}),
        ...(Array.isArray(a.pathPoints) && a.pathPoints.every(isNum) ? { pathPoints: a.pathPoints } : {}),
      })),
    shapes: (Array.isArray(raw?.shapes) ? raw.shapes : [])
      .filter((s: any) => typeof s?.id === 'string' && isShapeKind(s.kind) && isNum(s.x1) && isNum(s.y1) && isNum(s.x2) && isNum(s.y2))
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
};

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    canUndo: computed(() => store.past().length > 0),
    canRedo: computed(() => store.future().length > 0),
    hasArrows: computed(
      () => store.arrows().length > 0 || store.shapes().length > 0 || store.texts().length > 0
    ),
    frameCount: computed(() => store.frames().length),
  })),
  withMethods((store) => ({
    updatePosition(id: string, x: number, y: number) {
      patchState(store, (state) =>
        withHistory(state, {
          entities: state.entities.map((e) => (e.id === id ? { ...e, x, y } : e)),
        })
      );
    },
    updateEntityMeta(id: string, patch: Partial<Omit<TacticalEntity, 'id' | 'type'>>) {
      patchState(store, (state) =>
        withHistory(state, {
          entities: state.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })
      );
    },
    addEntity(entity: Omit<TacticalEntity, 'id'> & { id?: string }) {
      const id = entity.id ?? crypto.randomUUID();
      patchState(store, (state) =>
        withHistory(state, {
          entities: [...state.entities, { ...entity, id }],
        })
      );
      return id;
    },
    removeEntity(id: string) {
      patchState(store, (state) =>
        withHistory(state, {
          entities: state.entities.filter((e) => e.id !== id),
        })
      );
    },
    setTeamColor(team: 'home' | 'away', color: string) {
      patchState(store, team === 'home' ? { homeColor: color } : { awayColor: color });
    },
    applyFormation(team: 'home' | 'away', formation: FormationName) {
      const fresh = getFormationEntities(team, formation);
      const freshMap = new Map(fresh.map((e) => [e.id, e]));
      patchState(store, (state) => {
        // Preserve custom names/facing on existing team tokens while moving to the new formation
        const keptOthers = state.entities.filter((e) => e.type !== team);
        const existingTeam = new Map(state.entities.filter((e) => e.type === team).map((e) => [e.id, e]));
        const updatedTeam = fresh.map((f) => {
          const prev = existingTeam.get(f.id);
          return prev ? { ...prev, x: f.x, y: f.y, label: f.label } : f;
        });
        // Keep any extra bench players added beyond the 11 formation slots
        const extraTeam = state.entities.filter((e) => e.type === team && !freshMap.has(e.id));
        return {
          ...(team === 'home' ? { homeFormation: formation } : { awayFormation: formation }),
          ...withHistory(state, {
            entities: [...keptOthers, ...updatedTeam, ...extraTeam],
          }),
        };
      });
    },
    addArrow(
      points: [number, number, number, number],
      style: ArrowStyle = 'pass',
      options?: { color?: string; strokeWidth?: number; pathPoints?: number[] }
    ) {
      patchState(store, (state) =>
        withHistory(state, {
          arrows: [
            ...state.arrows,
            {
              id: crypto.randomUUID(),
              points,
              style,
              ...(options?.color ? { color: options.color } : {}),
              ...(options?.strokeWidth ? { strokeWidth: options.strokeWidth } : {}),
              ...(options?.pathPoints ? { pathPoints: options.pathPoints } : {}),
            },
          ],
        })
      );
    },
    updateArrowControl(id: string, controlPoint: [number, number]) {
      patchState(store, (state) =>
        withHistory(state, {
          arrows: state.arrows.map((a) => (a.id === id ? { ...a, controlPoint } : a)),
        })
      );
    },
    removeArrow(id: string) {
      patchState(store, (state) =>
        withHistory(state, {
          arrows: state.arrows.filter((a) => a.id !== id),
        })
      );
    },
    addShape(shape: Omit<TacticalShape, 'id'>) {
      patchState(store, (state) =>
        withHistory(state, {
          shapes: [...state.shapes, { ...shape, id: crypto.randomUUID() }],
        })
      );
    },
    removeShape(id: string) {
      patchState(store, (state) =>
        withHistory(state, {
          shapes: state.shapes.filter((s) => s.id !== id),
        })
      );
    },
    addText(textItem: Omit<TacticalText, 'id'>) {
      patchState(store, (state) =>
        withHistory(state, {
          texts: [...state.texts, { ...textItem, id: crypto.randomUUID() }],
        })
      );
    },
    updateTextPosition(id: string, x: number, y: number) {
      patchState(store, (state) =>
        withHistory(state, {
          texts: state.texts.map((t) => (t.id === id ? { ...t, x, y } : t)),
        })
      );
    },
    removeText(id: string) {
      patchState(store, (state) =>
        withHistory(state, {
          texts: state.texts.filter((t) => t.id !== id),
        })
      );
    },
    clearArrows() {
      patchState(store, (state) =>
        state.arrows.length || state.shapes.length || state.texts.length
          ? withHistory(state, { arrows: [], shapes: [], texts: [] })
          : {}
      );
    },
    updateFrameNote(note: string) {
      patchState(store, (state) => {
        const next: Snapshot = { ...snapshotOf(state), note };
        return {
          note,
          frames: setFrame(state.frames, state.currentFrame, next),
        };
      });
    },
    /** Restores the starting formation and removes all drawings of the current frame (undoable). */
    reset() {
      patchState(store, (state) => ({
        homeFormation: '4-3-3' as FormationName,
        awayFormation: '4-2-3-1' as FormationName,
        ...withHistory(state, {
          entities: INITIAL_ENTITIES,
          arrows: [],
          shapes: [],
          texts: [],
        }),
      }));
    },
    /** Replaces the current frame, e.g. when loading a saved board (undoable). */
    replaceBoard(entities: TacticalEntity[], arrows: TacticalArrow[]) {
      patchState(store, (state) => withHistory(state, { entities, arrows }));
    },
    undo() {
      patchState(store, (state) => {
        const prev = state.past[state.past.length - 1];
        if (!prev) return {};
        return {
          ...prev,
          shapes: prev.shapes ?? [],
          texts: prev.texts ?? [],
          note: prev.note ?? '',
          frames: setFrame(state.frames, state.currentFrame, prev),
          past: state.past.slice(0, -1),
          future: [snapshotOf(state), ...state.future],
        };
      });
    },
    redo() {
      patchState(store, (state) => {
        const next = state.future[0];
        if (!next) return {};
        return {
          ...next,
          shapes: next.shapes ?? [],
          texts: next.texts ?? [],
          note: next.note ?? '',
          frames: setFrame(state.frames, state.currentFrame, next),
          past: [...state.past, snapshotOf(state)],
          future: state.future.slice(1),
        };
      });
    },

    // ---- Timeline ----
    goToFrame(index: number) {
      patchState(store, (state) =>
        index === state.currentFrame || index < 0 || index >= state.frames.length
          ? {}
          : showFrame(state.frames, index)
      );
    },
    /** New step after the current one: same positions and shapes, no arrows. */
    addFrame() {
      patchState(store, (state) => {
        if (state.frames.length >= MAX_FRAMES) return {};
        const frames = [...state.frames];
        frames.splice(state.currentFrame + 1, 0, {
          entities: state.entities,
          arrows: [],
          shapes: state.shapes,
          texts: [],
          note: '',
        });
        return showFrame(frames, state.currentFrame + 1);
      });
    },
    /** Copy of the current step, including its arrows, shapes, and texts. */
    duplicateFrame() {
      patchState(store, (state) => {
        if (state.frames.length >= MAX_FRAMES) return {};
        const frames = [...state.frames];
        frames.splice(state.currentFrame + 1, 0, snapshotOf(state));
        return showFrame(frames, state.currentFrame + 1);
      });
    },
    deleteFrame() {
      patchState(store, (state) => {
        if (state.frames.length < 2) return {};
        const frames = state.frames.filter((_, i) => i !== state.currentFrame);
        return showFrame(frames, Math.min(state.currentFrame, frames.length - 1));
      });
    },
    setStepDuration(ms: number) {
      patchState(store, { stepDurationMs: clampStep(ms) });
    },

    /** Serializable copy of the whole timeline. */
    exportBoard() {
      return {
        version: 3,
        homeFormation: store.homeFormation(),
        awayFormation: store.awayFormation(),
        homeColor: store.homeColor(),
        awayColor: store.awayColor(),
        frames: store.frames(),
        currentFrame: store.currentFrame(),
        stepDurationMs: store.stepDurationMs(),
      };
    },
    /** Loads a saved timeline (or a legacy single-board save). Returns false if the data is unusable. */
    importBoard(data: any): boolean {
      if (typeof data !== 'object' || data === null) return false;
      const rawFrames = Array.isArray(data.frames) && data.frames.length ? data.frames.slice(0, MAX_FRAMES) : [data];
      const frames = rawFrames.map(sanitizeFrame);
      const index = isNum(data.currentFrame)
        ? Math.min(frames.length - 1, Math.max(0, Math.floor(data.currentFrame)))
        : 0;
      patchState(store, (state) => ({
        ...showFrame(frames, index),
        stepDurationMs: isNum(data.stepDurationMs) ? clampStep(data.stepDurationMs) : state.stepDurationMs,
        ...(typeof data.homeColor === 'string' ? { homeColor: data.homeColor } : {}),
        ...(typeof data.awayColor === 'string' ? { awayColor: data.awayColor } : {}),
      }));
      return true;
    },
  }))
);
