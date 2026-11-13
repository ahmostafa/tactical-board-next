import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export interface TacticalEntity {
  id: string;
  type: 'home' | 'away' | 'ball';
  x: number;
  y: number;
  label?: string; // Added to hold the player number
}

export interface TacticalArrow {
  id: string;
  points: [number, number, number, number];
}

interface Snapshot {
  entities: TacticalEntity[];
  arrows: TacticalArrow[];
}

const MAX_HISTORY = 100;

const initialState = {
  entities: [
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
  ] as TacticalEntity[],
  arrows: [] as TacticalArrow[],
  past: [] as Snapshot[],
  future: [] as Snapshot[],
};

type State = typeof initialState;

// Pushes the current snapshot onto the undo stack and clears redo.
const withHistory = (state: State, changes: Partial<Snapshot>): Partial<State> => ({
  ...changes,
  past: [...state.past, { entities: state.entities, arrows: state.arrows }].slice(-MAX_HISTORY),
  future: [],
});

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    canUndo: computed(() => store.past().length > 0),
    canRedo: computed(() => store.future().length > 0),
    hasArrows: computed(() => store.arrows().length > 0),
  })),
  withMethods((store) => ({
    updatePosition(id: string, x: number, y: number) {
      patchState(store, (state) =>
        withHistory(state, {
          entities: state.entities.map((e) => (e.id === id ? { ...e, x, y } : e)),
        })
      );
    },
    addArrow(points: [number, number, number, number]) {
      patchState(store, (state) =>
        withHistory(state, { arrows: [...state.arrows, { id: crypto.randomUUID(), points }] })
      );
    },
    clearArrows() {
      patchState(store, (state) => (state.arrows.length ? withHistory(state, { arrows: [] }) : {}));
    },
    /** Restores the starting formation and removes all arrows (undoable). */
    reset() {
      patchState(store, (state) =>
        withHistory(state, { entities: initialState.entities, arrows: [] })
      );
    },
    /** Replaces the whole board, e.g. when loading a saved one (undoable). */
    replaceBoard(entities: TacticalEntity[], arrows: TacticalArrow[]) {
      patchState(store, (state) => withHistory(state, { entities, arrows }));
    },
    undo() {
      patchState(store, (state) => {
        const prev = state.past[state.past.length - 1];
        if (!prev) return {};
        return {
          ...prev,
          past: state.past.slice(0, -1),
          future: [{ entities: state.entities, arrows: state.arrows }, ...state.future],
        };
      });
    },
    redo() {
      patchState(store, (state) => {
        const next = state.future[0];
        if (!next) return {};
        return {
          ...next,
          past: [...state.past, { entities: state.entities, arrows: state.arrows }],
          future: state.future.slice(1),
        };
      });
    },
  }))
);
