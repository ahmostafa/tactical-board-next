import { TestBed } from '@angular/core/testing';
import { BoardStore } from './board.store';
import { getFormationEntities } from './formations.data';
import { encodeSchemeHash, decodeSchemeHash } from './board-storage';

describe('BoardStore & Tactical Features', () => {
  let store: InstanceType<typeof BoardStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BoardStore]
    });
    store = TestBed.inject(BoardStore);
  });

  it('should initialize with 22 players and 1 ball', () => {
    expect(store.entities().length).toBe(23);
    expect(store.entities().filter((e) => e.type === 'home').length).toBe(11);
    expect(store.entities().filter((e) => e.type === 'away').length).toBe(11);
    expect(store.entities().filter((e) => e.type === 'ball').length).toBe(1);
  });

  it('should apply formations and team colors while preserving player metadata', () => {
    store.updateEntityMeta('h10', { name: 'Playmaker', showVision: true, facing: 45 });
    store.applyFormation('home', '4-4-2');
    store.setTeamColor('home', '#10b981');
    const h10 = store.entities().find((e) => e.id === 'h10');
    expect(h10).toBeTruthy();
    expect(h10?.name).toBe('Playmaker');
    expect(h10?.showVision).toBe(true);
    expect(store.homeColor()).toBe('#10b981');

    const awayPositions = getFormationEntities('away', '3-5-2');
    expect(awayPositions.length).toBe(11);
  });

  it('should add and remove equipment, shapes, texts, and arrows', () => {
    const eqId = store.addEntity({
      type: 'equipment',
      x: 300,
      y: 300,
      equipmentKind: 'cone',
      color: '#f97316'
    });
    expect(store.entities().some((e) => e.id === eqId)).toBe(true);

    store.addArrow([100, 100, 200, 200], 'block', {
      color: '#ef4444',
      strokeWidth: 4
    });
    expect(store.arrows().length).toBe(1);
    expect(store.arrows()[0].style).toBe('block');

    store.addShape({
      kind: 'rect',
      x1: 100,
      y1: 100,
      x2: 250,
      y2: 220,
      color: '#facc15'
    });
    expect(store.shapes().length).toBe(1);

    store.addText({
      x: 400,
      y: 300,
      text: 'HIGH PRESS',
      fontSize: 22,
      color: '#ffffff'
    });
    expect(store.texts().length).toBe(1);

    store.updateFrameNote('Press trigger on back-pass');
    expect(store.frames()[store.currentFrame()].note).toBe('Press trigger on back-pass');

    store.removeArrow(store.arrows()[0].id);
    store.removeShape(store.shapes()[0].id);
    store.removeText(store.texts()[0].id);
    store.removeEntity(eqId);

    expect(store.arrows().length).toBe(0);
    expect(store.shapes().length).toBe(0);
    expect(store.texts().length).toBe(0);
    expect(store.entities().some((e) => e.id === eqId)).toBe(false);
  });

  it('should encode and decode scheme URL hash losslessly', () => {
    store.updateFrameNote('Corner kick routine');
    const hash = encodeSchemeHash(store.frames());
    expect(hash.startsWith('#scheme=')).toBe(true);

    const decoded = decodeSchemeHash(hash);
    expect(decoded).toBeTruthy();
    expect(decoded?.length).toBe(1);
    expect(decoded?.[0].note).toBe('Corner kick routine');
  });
});
