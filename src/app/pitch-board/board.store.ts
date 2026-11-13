import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export interface TacticalEntity {
  id: string;
  type: 'home' | 'away' | 'ball';
  x: number;
  y: number;
  label?: string; // Added to hold the player number
}

export type ArrowStyle = 'pass' | 'run' | 'dribble' | 'zone';

export interface TacticalArrow {
  id: string;
  points: [number, number, number, number];
  style?: ArrowStyle;
  controlPoint?: [number, number];
}

interface Snapshot {
  entities: TacticalEntity[];
  arrows: TacticalArrow[];
}

const MAX_HISTORY = 100;

const INITIAL_ENTITIES = [
    // Home Team: 4-3-3 (Red, defending left side)
    { id: 'h1', type: 'home', x: 50, y: 340, label: '1' },
    { id: 'h2', type: 'home', x: 200, y: 580, label: '2' },
    { id: 'h3', type: 'home', x: 200, y: 100, label: '3' },
    { id: 'h4', type: 'home', x: 180, y: 420, label: '4' },
    { id: 'h5', type: 'home', x: 180, y: 260, label: '5' },
    { id: 'h6', type: 'home', x: 320, y: 340, label: '6' },
    { id: 'h8', type: 'home', x: 360, y: 500, label: '8' },
    { id: 'h10', type: 'home', x: 360, y: 180, label: '10' },
    { id: 'h7', type: 'home', x: 480, y: 560, label: '7' },
    { id: 'h9', type: 'home', x: 500, y: 340, label: '9' },
    { id: 'h11', type: 'home', x: 480, y: 120, label: '11' },

    // Away Team: 4-2-3-1 (Blue, defending right side)
    { id: 'a1', type: 'away', x: 1000, y: 340, label: '1' },
    { id: 'a2', type: 'away', x: 850, y: 100, label: '2' },
    { id: 'a3', type: 'away', x: 850, y: 580, label: '3' },
    { id: 'a4', type: 'away', x: 870, y: 260, label: '4' },
    { id: 'a5', type: 'away', x: 870, y: 420, label: '5' },
    { id: 'a6', type: 'away', x: 750, y: 260, label: '6' },
    { id: 'a8', type: 'away', x: 750, y: 420, label: '8' },
    { id: 'a10', type: 'away', x: 680, y: 340, label: '10' },
    { id: 'a7', type: 'away', x: 650, y: 140, label: '7' },
    { id: 'a9', type: 'away', x: 550, y: 340, label: '9' },
    { id: 'a11', type: 'away', x: 650, y: 540, label: '11' },

    // The Ball
    { id: 'ball', type: 'ball', x: 525, y: 340 },
] as TacticalEntity[];

const initialState = {
  // Working copy of the frame being edited (kept in sync with frames[currentFrame])
  entities: INITIAL_ENTITIES,
  arrows: [] as TacticalArrow[],
  // Timeline: one snapshot per keyframe, arrows belong to the frame they were drawn on
  frames: [{ entities: INITIAL_ENTITIES, arrows: [] as TacticalArrow[] }] as Snapshot[],
  currentFrame: 0,
  stepDurationMs: 1000,
  past: [] as Snapshot[],
  future: [] as Snapshot[],
};

type State = typeof initialState;

const MAX_FRAMES = 50;
const MIN_STEP_MS = 200;
const MAX_STEP_MS = 5000;

const snapshotOf = (s: Snapshot): Snapshot => ({ entities: s.entities, arrows: s.arrows });
const setFrame = (frames: Snapshot[], index: number, snap: Snapshot) =>
  frames.map((f, i) => (i === index ? snap : f));

// Applies a change to the current frame and pushes the previous snapshot onto the undo stack.
const withHistory = (state: State, changes: Partial<Snapshot>): Partial<State> => {
  const next: Snapshot = {
    entities: changes.entities ?? state.entities,
    arrows: changes.arrows ?? state.arrows,
  };
  return {
    ...next,
    frames: setFrame(state.frames, state.currentFrame, next),
    past: [...state.past, snapshotOf(state)].slice(-MAX_HISTORY),
    future: [],
  };
};

// Switches the working copy to another frame. Undo history is per frame, so it is cleared.
const showFrame = (frames: Snapshot[], index: number): Partial<State> => ({
  frames,
  currentFrame: index,
  entities: frames[index].entities,
  arrows: frames[index].arrows,
  past: [],
  future: [],
});

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clampStep = (ms: number) => Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, Math.round(ms)));

const isArrowStyle = (v: unknown): v is ArrowStyle =>
  v === 'pass' || v === 'run' || v === 'dribble' || v === 'zone';

/** Rebuilds a frame from untrusted data, keeping only known players and valid arrows. */
const sanitizeFrame = (raw: any): Snapshot => {
  const saved = new Map<string, { x: number; y: number }>();
  (Array.isArray(raw?.entities) ? raw.entities : []).forEach((e: any) => {
    if (typeof e?.id === 'string' && isNum(e.x) && isNum(e.y)) saved.set(e.id, { x: e.x, y: e.y });
  });
  return {
    entities: INITIAL_ENTITIES.map((e) => ({ ...e, ...(saved.get(e.id) ?? {}) })),
    arrows: (Array.isArray(raw?.arrows) ? raw.arrows : [])
      .filter((a: any) => typeof a?.id === 'string' && Array.isArray(a.points) && a.points.length === 4 && a.points.every(isNum))
      .map((a: any): TacticalArrow => ({
        id: a.id,
        points: [a.points[0], a.points[1], a.points[2], a.points[3]],
        style: isArrowStyle(a.style) ? a.style : 'pass',
        ...(Array.isArray(a.controlPoint) && a.controlPoint.length === 2 && a.controlPoint.every(isNum)
          ? { controlPoint: [a.controlPoint[0], a.controlPoint[1]] }
          : {}),
      })),
  };
};

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    canUndo: computed(() => store.past().length > 0),
    canRedo: computed(() => store.future().length > 0),
    hasArrows: computed(() => store.arrows().length > 0),
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
    addArrow(points: [number, number, number, number], style: ArrowStyle = 'pass') {
      patchState(store, (state) =>
        withHistory(state, { arrows: [...state.arrows, { id: crypto.randomUUID(), points, style }] })
      );
    },
    updateArrowControl(id: string, controlPoint: [number, number]) {
      patchState(store, (state) =>
        withHistory(state, {
          arrows: state.arrows.map((a) => (a.id === id ? { ...a, controlPoint } : a)),
        })
      );
    },
    clearArrows() {
      patchState(store, (state) => (state.arrows.length ? withHistory(state, { arrows: [] }) : {}));
    },
    /** Restores the starting formation and removes all arrows of the current frame (undoable). */
    reset() {
      patchState(store, (state) => withHistory(state, { entities: INITIAL_ENTITIES, arrows: [] }));
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
    /** New step after the current one: same positions, no arrows. */
    addFrame() {
      patchState(store, (state) => {
        if (state.frames.length >= MAX_FRAMES) return {};
        const frames = [...state.frames];
        frames.splice(state.currentFrame + 1, 0, { entities: state.entities, arrows: [] });
        return showFrame(frames, state.currentFrame + 1);
      });
    },
    /** Copy of the current step, including its arrows. */
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
        version: 2,
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
      }));
      return true;
    },
  }))
);
