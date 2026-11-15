import { TestBed } from '@angular/core/testing';
import { BoardStore } from './board.store';
import { getFormationEntities } from './formations.data';
import { encodeSchemeHash, decodeSchemeHash } from './board-storage';
import { DEMO_TACTICS, TOUR_STEPS } from './demo-tactics.data';
import { computeArrowPath, computeTBarPoints } from './canvas/arrow-renderer';
import {
  evaluatePositionalSpacing,
  getTacticalLocationSummary,
  getZone18,
  getZone20,
} from './canvas/pitch-divisions';

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

  it('should support Empty Pitch, 7v7, and 5v5 squad presets and clearing entities', () => {
    store.applySquadPreset('empty');
    expect(store.squadPreset()).toBe('empty');
    expect(store.entities().length).toBe(0);

    store.clearEntities(true);
    expect(store.entities().length).toBe(1);
    expect(store.entities()[0].type).toBe('ball');

    store.applySquadPreset('7v7');
    expect(store.squadPreset()).toBe('7v7');
    expect(store.entities().filter((e) => e.type === 'home').length).toBe(7);
    expect(store.entities().filter((e) => e.type === 'away').length).toBe(7);

    store.applySquadPreset('5v5');
    expect(store.entities().filter((e) => e.type === 'home').length).toBe(5);
    expect(store.entities().filter((e) => e.type === 'away').length).toBe(5);

    store.clearEntities(false);
    expect(store.squadPreset()).toBe('empty');
    expect(store.entities().length).toBe(0);
  });

  it('should import built-in demo tactics and provide 6 interactive tour steps', () => {
    expect(TOUR_STEPS.length).toBe(6);
    expect(DEMO_TACTICS.length).toBe(3);

    const overloadDemo = DEMO_TACTICS[0];
    const ok = store.importBoard({
      version: 3,
      squadPreset: overloadDemo.squadPreset,
      frames: overloadDemo.frames,
    });
    expect(ok).toBe(true);
    expect(store.squadPreset()).toBe('empty');
    expect(store.frameCount()).toBe(3);
    expect(store.entities().length).toBe(10);
  });

  it('should compute straight, curved, wavy dribble, and block T-bar arrow geometry', () => {
    const straight = computeArrowPath([100, 100, 300, 100], 'pass');
    expect(straight).toEqual([100, 100, 300, 100]);

    const curved = computeArrowPath([100, 100, 300, 100], 'run', [200, 50]);
    expect(curved.length).toBeGreaterThan(4);

    const dribble = computeArrowPath([100, 100, 300, 100], 'dribble');
    expect(dribble.length).toBeGreaterThan(20);

    const tbar = computeTBarPoints([100, 100, 200, 100]);
    expect(tbar).toEqual([200, 86, 200, 114]);
  });

  it('should map FIFA 105m x 68m coordinates to 18-Zone, 20-Zone, and Specialized Sub-Zones', () => {
    expect(getZone18(5, 10)).toBe(1);
    expect(getZone18(5, 34)).toBe(2);
    expect(getZone18(78, 34)).toBe(14);
    expect(getZone18(98, 34)).toBe(17);
    expect(getZone18(104, 65)).toBe(18);

    expect(getZone20(10, 5)).toBe('B-LF');
    expect(getZone20(65, 19)).toBe('C-LHS');
    expect(getZone20(65, 48)).toBe('C-RHS');
    expect(getZone20(95, 34)).toBe('F-C');

    const z14Summary = getTacticalLocationSummary(780, 340);
    expect(z14Summary.zone18).toBe(14);
    expect(z14Summary.third).toBe('Final Third');
    expect(z14Summary.channel).toBe('Central Corridor');
    expect(z14Summary.subZones).toContain('Zone 14 (Assist)');

    const goldenSummary = getTacticalLocationSummary(980, 340);
    expect(goldenSummary.zone18).toBe(17);
    expect(goldenSummary.subZones).toContain('Golden Zone');

    const crowdedChannel = evaluatePositionalSpacing([
      { id: 'h2', type: 'home', x: 200, y: 180, label: '2' },
      { id: 'h8', type: 'home', x: 500, y: 190, label: '8' },
      { id: 'h10', type: 'home', x: 700, y: 200, label: '10' },
    ]);
    expect(crowdedChannel.some((v) => v.kind === 'channel' && v.code === 'LHS')).toBe(true);
  });
});
