import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ChangeDetectionStrategy,
  inject,
  signal,
  effect,
  computed,
  HostListener,
} from '@angular/core';
import Konva from 'konva';
import { BoardStore } from './board.store';
import {
  ActiveToolMode,
  ArrowStyle,
  BASE_HEIGHT,
  BASE_WIDTH,
  BOARD_ZOOM_LEVELS,
  CURSORS,
  DRAWING_COLORS,
  DemoTacticPreset,
  EquipmentKind,
  FULL_VIEW_H,
  FULL_VIEW_W,
  FormationName,
  GOAL_DEPTH,
  GOAL_TOP,
  GOAL_WIDTH,
  HALF_VIEW_W,
  PITCH_PAD_X,
  PITCH_PAD_Y,
  PaletteDragPayload,
  PitchDivisionGridMode,
  PitchDivisionsConfig,
  PitchSubZoneId,
  PitchViewMode,
  STORAGE_KEY,
  SavedCollectionItem,
  ShapeKind,
  SquadPreset,
  TEAM_COLOR_PRESETS,
  TacticalArrow,
  TacticalEntity,
  TacticalShape,
  TacticalText,
} from './models/tactical-board.models';
import { FORMATION_NAMES, SQUAD_PRESET_OPTIONS } from './formations.data';
import { EQUIPMENT_CATALOG } from './equipment-renderer';
import { DEMO_TACTICS, TOUR_STEPS } from './demo-tactics.data';
import {
  loadCollections,
  saveToCollections,
  deleteFromCollections,
  encodeSchemeHash,
  decodeSchemeHash,
} from './board-storage';
import {
  drawPitchDivisions,
  drawPitchSurface,
  renderGoalScoredOverlay,
} from './canvas/pitch-renderer';
import {
  DEFAULT_DIVISIONS_CONFIG,
  isAnyDivisionActive,
} from './canvas/pitch-divisions';
import {
  createArrowGroup,
  createShapeNode,
  renderGhostLayer,
  updateArrowGroup,
} from './canvas/arrow-renderer';
import { renderTextsOnLayer, syncEntityNodes } from './canvas/entity-renderer';
import { BoardExportService } from './services/board-export.service';
import { TourDemosPanelComponent } from './components/tour-demos-panel.component';
import { EquipmentPaletteComponent } from './components/equipment-palette.component';
import { TokenInspectorComponent } from './components/token-inspector.component';
import { CollectionsDrawerComponent } from './components/collections-drawer.component';
import { TimelineBarComponent } from './components/timeline-bar.component';

export { TEAM_COLOR_PRESETS, DRAWING_COLORS, CURSORS, BOARD_ZOOM_LEVELS };
export type { PitchViewMode, ActiveToolMode };

@Component({
  selector: 'app-pitch-board',
  standalone: true,
  imports: [
    TourDemosPanelComponent,
    EquipmentPaletteComponent,
    TokenInspectorComponent,
    CollectionsDrawerComponent,
    TimelineBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pitch-board.component.html',
})
export class PitchBoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  private exportService = inject(BoardExportService);
  protected store = inject(BoardStore);

  protected readonly formations = FORMATION_NAMES;
  protected readonly squadPresets = SQUAD_PRESET_OPTIONS;
  protected readonly drawingColors = DRAWING_COLORS;
  protected readonly equipmentCatalog = EQUIPMENT_CATALOG;
  protected readonly demoTactics = DEMO_TACTICS;
  protected readonly tourSteps = TOUR_STEPS;

  // UI Signals
  activeTool = signal<ActiveToolMode>('move');
  isDrawingMode = computed(() => this.activeTool() !== 'move');
  arrowStyle = signal<ArrowStyle>('pass');
  shapeKind = signal<ShapeKind>('rect');
  drawColor = signal('#f1c40f');
  drawWidth = signal(4);
  pendingText = signal('Press Trigger');
  textSize = signal(18);

  pitchView = signal<PitchViewMode>('full');
  boardZoom = signal(0.9);
  showStripes = signal(true);
  showMarkings = signal(true);
  divisionsConfig = signal<PitchDivisionsConfig>({
    grid: 'none',
    subZones: { ...DEFAULT_DIVISIONS_CONFIG.subZones },
    mirrorSubZones: false,
  });
  showDivisionsPanel = signal(false);
  showDivisions = computed(() => isAnyDivisionActive(this.divisionsConfig()));
  activeSubZoneCount = computed(
    () => Object.values(this.divisionsConfig().subZones).filter(Boolean).length
  );
  showGhost = signal(true);
  loopPlayback = signal(false);
  showEquipmentTray = signal(false);
  showCollections = signal(false);
  showDemos = signal(false);
  showTour = signal(false);
  tourIndex = signal(0);
  private draggedPaletteItem: PaletteDragPayload | null = null;

  /** Counter-rotation applied to upright elements (numbers, names, cones, text) when stage is rotated 90 deg in vertical view. */
  uprightRotation = computed(() => (this.pitchView() === 'vertical' ? -90 : 0));

  containerAspect = computed(() => {
    const v = this.pitchView();
    if (v === 'vertical') return `${FULL_VIEW_H} / ${FULL_VIEW_W}`;
    if (v === 'half-left' || v === 'half-right') return `${HALF_VIEW_W} / ${FULL_VIEW_H}`;
    return `${FULL_VIEW_W} / ${FULL_VIEW_H}`;
  });

  containerMaxWidth = computed(() => {
    const z = this.boardZoom();
    const v = this.pitchView();
    if (z <= 0.9) {
      if (v === 'vertical') return `min(${Math.round(490 * z)}px, calc((100dvh - 210px) * 0.648 * ${z}))`;
      if (v === 'half-left' || v === 'half-right') return `min(${Math.round(550 * z)}px, calc((100dvh - 210px) * 0.779 * ${z}))`;
      return `min(${Math.round(920 * z)}px, calc((100dvh - 210px) * 1.541 * ${z}))`;
    }
    if (v === 'vertical') return `${Math.round(520 * z)}px`;
    if (v === 'half-left' || v === 'half-right') return `${Math.round(580 * z)}px`;
    return `${Math.round(960 * z)}px`;
  });

  selectedEntityId = signal<string | null>(null);
  selectedEntity = computed(() => {
    const id = this.selectedEntityId();
    if (!id) return null;
    return this.store.entities().find((e) => e.id === id) ?? null;
  });

  collections = signal<SavedCollectionItem[]>(loadCollections());
  collectionTitle = signal('');
  collectionCategory = signal<SavedCollectionItem['category']>('Match Tactic');

  isPlaying = signal(false);
  isExporting = signal(false);
  exportKind = signal<'mp4' | 'gif'>('mp4');
  exportProgress = signal(0);
  scrubPos = signal(0);
  hasSavedBoard = signal(localStorage.getItem(STORAGE_KEY) !== null);
  statusMessage = signal('');
  private statusTimer?: ReturnType<typeof setTimeout>;

  // Konva Core
  private stage!: Konva.Stage;
  private pitchLayer!: Konva.Layer;
  private divisionsLayer!: Konva.Layer;
  private shapesLayer!: Konva.Layer;
  private ghostLayer!: Konva.Layer;
  private drawingLayer!: Konva.Layer;
  private entityLayer!: Konva.Layer;
  private resizeObserver!: ResizeObserver;

  // Drawing State
  private currentArrow: Konva.Group | null = null;
  private currentShape: Konva.Shape | null = null;
  private currentArrowStart: [number, number] = [0, 0];
  private currentArrowEnd: [number, number] = [0, 0];
  private freehandPoints: number[] = [];

  // Timeline Playback State
  private activeTweens: Konva.Tween[] = [];
  private playbackTarget = 0;
  private singleStepOnly = false;

  constructor() {
    effect(() => {
      this.showGhost();
      this.store.homeColor();
      this.store.awayColor();
      if (this.isPlaying() || this.isExporting()) return;
      this.syncFromStore();
    });
  }

  ngAfterViewInit() {
    const fromUrl = decodeSchemeHash(window.location.hash);
    if (fromUrl) {
      this.store.importBoard(fromUrl);
      this.showStatus('Loaded tactical scheme from shared link');
    }

    const testCanvas = document.createElement('canvas');
    if (typeof testCanvas.getContext !== 'function' || !testCanvas.getContext('2d')) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.initCanvas();
      drawPitchSurface(this.pitchLayer, this.showStripes(), this.showMarkings());
      this.refreshDivisionsLayer();
      this.syncFromStore();
      this.setupDrawingEngine();
      this.setupResponsiveObserver();
    });
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  // ---- Store -> Konva Sync ----
  private syncFromStore() {
    const entities = this.store.entities();
    const arrows = this.store.arrows();
    const shapes = this.store.shapes();
    const texts = this.store.texts();
    const note = this.store.note();
    const frames = this.store.frames();
    const current = this.store.currentFrame();
    const ghost = this.showGhost();
    if (!this.entityLayer) return;

    this.syncEntities(entities);
    this.renderShapes(shapes);
    this.renderArrows(arrows, !this.isPlaying() && !this.isExporting());
    this.renderTexts(texts, note);
    renderGoalScoredOverlay(this.drawingLayer, entities, this.uprightRotation());
    this.drawingLayer.opacity(1);
    renderGhostLayer(
      this.ghostLayer,
      ghost && current > 0 ? frames[current - 1].entities : null,
      entities,
      this.store.homeColor(),
      this.store.awayColor()
    );
    this.scrubPos.set(current);

    this.shapesLayer.batchDraw();
    this.entityLayer.batchDraw();
    this.drawingLayer.batchDraw();
    this.ghostLayer.batchDraw();
  }

  private renderShapes(shapes: TacticalShape[]) {
    this.shapesLayer.destroyChildren();
    const isEraser = this.activeTool() === 'eraser';
    shapes.forEach((s) => {
      const node = createShapeNode(s, isEraser);
      node.on('mouseenter', () => {
        if (this.activeTool() === 'eraser') {
          this.setStageCursor(CURSORS.eraserHot);
        }
      });
      node.on('mouseleave', () => this.setStageCursor(this.defaultToolCursor()));
      node.on('click tap', (e) => {
        if (this.activeTool() === 'eraser') {
          e.cancelBubble = true;
          this.ngZone.run(() => this.store.removeShape(s.id));
          this.setStageCursor(this.defaultToolCursor());
        }
      });
      this.shapesLayer.add(node);
    });
  }

  private renderTexts(texts: TacticalText[], frameNote: string) {
    renderTextsOnLayer(this.drawingLayer, texts, frameNote, {
      activeTool: () => this.activeTool(),
      isPlaying: () => this.isPlaying(),
      isExporting: () => this.isExporting(),
      uprightRotation: () => this.uprightRotation(),
      pitchView: () => this.pitchView(),
      defaultToolCursor: () => this.defaultToolCursor(),
      setStageCursor: (c) => this.setStageCursor(c),
      clampStageDragPos: (pos, m) => this.clampStageDragPos(pos, m),
      onRemoveText: (id) => this.ngZone.run(() => this.store.removeText(id)),
      onUpdateTextPosition: (id, x, y) =>
        this.ngZone.run(() => this.store.updateTextPosition(id, x, y)),
    });
  }

  private renderArrows(arrows: TacticalArrow[], showHandles = false) {
    this.drawingLayer.destroyChildren();
    const isEraser = this.activeTool() === 'eraser';
    arrows.forEach((a) => {
      const arrowGroup = createArrowGroup(a, isEraser);
      if (isEraser) {
        arrowGroup.on('mouseenter', () => this.setStageCursor(CURSORS.eraserHot));
        arrowGroup.on('mouseleave', () => this.setStageCursor(this.defaultToolCursor()));
        arrowGroup.on('click tap', (e) => {
          e.cancelBubble = true;
          this.ngZone.run(() => this.store.removeArrow(a.id));
          this.setStageCursor(this.defaultToolCursor());
        });
      }
      this.drawingLayer.add(arrowGroup);

      if (showHandles && !isEraser && a.style !== 'freehand') {
        const [x1, y1, x2, y2] = a.points;
        const [cx, cy] = a.controlPoint ?? [(x1 + x2) / 2, (y1 + y2) / 2];
        const handle = new Konva.Circle({
          name: 'curve-handle',
          x: cx,
          y: cy,
          radius: 6,
          fill: '#ffffff',
          stroke: a.color ?? '#f1c40f',
          strokeWidth: 2,
          opacity: 0.85,
          draggable: true,
          dragBoundFunc: (pos) => this.clampStageDragPos(pos, 6),
        });
        handle.on('mouseenter', () => this.setStageCursor('grab'));
        handle.on('mouseleave', () => this.setStageCursor(this.defaultToolCursor()));
        handle.on('dragstart', () => this.setStageCursor('grabbing'));
        handle.on('dragmove', () => {
          const p = handle.position();
          updateArrowGroup(arrowGroup, a.points, a.style ?? 'pass', [p.x, p.y]);
        });
        handle.on('dragend', () => {
          this.setStageCursor('grab');
          const p = handle.position();
          this.ngZone.run(() =>
            this.store.updateArrowControl(a.id, [Math.round(p.x), Math.round(p.y)])
          );
        });
        this.drawingLayer.add(handle);
      }
    });
  }

  // ---- Keyboard Shortcuts ----
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (this.isPlaying() || this.isExporting()) return;

    if (!(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
      if (event.key === 'ArrowLeft') {
        this.store.goToFrame(this.store.currentFrame() - 1);
        return;
      }
      if (event.key === 'ArrowRight') {
        this.store.goToFrame(this.store.currentFrame() + 1);
        return;
      }
      if (event.key === 'Escape') {
        this.activeTool.set('move');
        this.selectedEntityId.set(null);
        this.updateDraggable();
        this.syncFromStore();
        return;
      }
    }

    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.store.undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.store.redo();
    }
  }

  // ---- Squad, Pitch View & Zoom Controls ----
  onSquadPresetChange(preset: SquadPreset) {
    this.store.applySquadPreset(preset);
    this.selectedEntityId.set(null);
    if (preset === 'empty') {
      this.showEquipmentTray.set(true);
      this.showStatus('Empty Pitch ready — drag players, balls, and equipment onto the pitch');
    } else {
      const label = this.squadPresets.find((p) => p.value === preset)?.label ?? preset;
      this.showStatus(`Switched mode to ${label}`);
    }
  }

  clearPitchForDrill(keepBall = false) {
    this.store.clearEntities(keepBall);
    this.selectedEntityId.set(null);
    this.showEquipmentTray.set(true);
    this.showStatus('Pitch cleared — drag players, balls, and equipment onto the pitch');
  }

  onFormationChange(team: 'home' | 'away', formation: FormationName) {
    this.store.applyFormation(team, formation);
    this.showStatus(`${team === 'home' ? 'Home' : 'Away'} formation set to ${formation}`);
  }

  onTeamColorChange(team: 'home' | 'away', color: string) {
    this.store.setTeamColor(team, color);
    this.syncFromStore();
  }

  setPitchView(view: PitchViewMode) {
    this.pitchView.set(view);
    setTimeout(() => {
      this.applyStageViewport();
      this.refreshDivisionsLayer();
      this.syncFromStore();
    }, 0);
  }

  setBoardZoom(zoom: number) {
    this.boardZoom.set(zoom);
    setTimeout(() => this.applyStageViewport(), 0);
  }

  stepBoardZoom(delta: -1 | 1) {
    const current = this.boardZoom();
    let idx = BOARD_ZOOM_LEVELS.findIndex((z) => Math.abs(z - current) < 0.01);
    if (idx === -1) {
      idx = BOARD_ZOOM_LEVELS.findIndex((z) => z >= current);
      if (idx === -1) idx = BOARD_ZOOM_LEVELS.length - 1;
    }
    const nextIdx = Math.max(0, Math.min(BOARD_ZOOM_LEVELS.length - 1, idx + delta));
    const nextZoom = BOARD_ZOOM_LEVELS[nextIdx];
    this.setBoardZoom(nextZoom);
    this.showStatus(`Zoom ${Math.round(nextZoom * 100)}%`);
  }

  toggleStripes() {
    this.showStripes.set(!this.showStripes());
    drawPitchSurface(this.pitchLayer, this.showStripes(), this.showMarkings());
    this.pitchLayer.batchDraw();
  }

  toggleMarkings() {
    this.showMarkings.set(!this.showMarkings());
    drawPitchSurface(this.pitchLayer, this.showStripes(), this.showMarkings());
    this.pitchLayer.batchDraw();
  }

  private refreshDivisionsLayer() {
    if (!this.divisionsLayer) return;
    drawPitchDivisions(
      this.divisionsLayer,
      this.uprightRotation(),
      this.divisionsConfig(),
      this.pitchView()
    );
  }

  toggleDivisions() {
    const nextPanel = !this.showDivisionsPanel();
    this.showDivisionsPanel.set(nextPanel);
    if (nextPanel && !this.showDivisions()) {
      this.divisionsConfig.update((c) => ({ ...c, grid: 'thirds-channels' }));
      this.refreshDivisionsLayer();
      this.showStatus('Pitch Divisions active — choose Grid or Sub-Zones below');
    }
  }

  setDivisionGrid(grid: PitchDivisionGridMode) {
    this.divisionsConfig.update((c) => ({ ...c, grid }));
    if (grid !== 'none') {
      this.showDivisionsPanel.set(true);
    }
    this.refreshDivisionsLayer();
    const names: Record<PitchDivisionGridMode, string> = {
      none: 'Primary Grid hidden',
      'thirds-channels': 'Grid: Thirds & 5 Vertical Channels',
      'zones-18': 'Grid: Standard 18-Zone Grid (3×6)',
      'zones-20': 'Grid: 20-Zone Juego de Posición (5×4)',
    };
    this.showStatus(names[grid]);
  }

  toggleSubZone(id: PitchSubZoneId) {
    this.divisionsConfig.update((c) => ({
      ...c,
      subZones: {
        ...c.subZones,
        [id]: !c.subZones[id],
      },
    }));
    this.refreshDivisionsLayer();
  }

  toggleMirrorSubZones() {
    this.divisionsConfig.update((c) => ({ ...c, mirrorSubZones: !c.mirrorSubZones }));
    this.refreshDivisionsLayer();
  }

  enableAllSubZones() {
    this.divisionsConfig.update((c) => ({
      ...c,
      subZones: { zone14: true, goldenZone: true, pockets: true, cutback: true },
    }));
    this.refreshDivisionsLayer();
    this.showStatus('Enabled Zone 14, Golden Zone, Pockets & Byline Cutback');
  }

  clearAllDivisions() {
    this.divisionsConfig.set({
      grid: 'none',
      subZones: { zone14: false, goldenZone: false, pockets: false, cutback: false },
      mirrorSubZones: false,
    });
    this.refreshDivisionsLayer();
    this.showStatus('Cleared all pitch divisions and sub-zones');
  }

  // ---- Drag & Drop Palette & Entity Spawning ----
  onPaletteDragStart(event: DragEvent, payload: PaletteDragPayload) {
    this.draggedPaletteItem = payload;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify(payload));
    }
  }

  onCanvasDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onCanvasDrop(event: DragEvent) {
    event.preventDefault();
    let payload = this.draggedPaletteItem;
    this.draggedPaletteItem = null;
    if (!payload && event.dataTransfer) {
      try {
        const raw = event.dataTransfer.getData('application/json');
        if (raw) payload = JSON.parse(raw);
      } catch {}
    }
    if (!payload || !this.stage) return;

    const rect = this.canvasContainer.nativeElement.getBoundingClientRect();
    const stageX = event.clientX - rect.left;
    const stageY = event.clientY - rect.top;
    const inv = this.stage.getAbsoluteTransform().copy().invert();
    const pt = inv.point({ x: stageX, y: stageY });
    const clampedX = Math.max(15, Math.min(BASE_WIDTH - 15, Math.round(pt.x)));
    const clampedY = Math.max(15, Math.min(BASE_HEIGHT - 15, Math.round(pt.y)));

    if (payload.category === 'squad' && payload.squadType) {
      this.spawnSquadToken(
        payload.squadType,
        [clampedX, clampedY],
        payload.roleLabel,
        payload.roleName
      );
    } else if (payload.category === 'equipment' && payload.equipmentKind) {
      this.spawnEquipment(
        payload.equipmentKind,
        payload.defaultColor ?? '#f97316',
        [clampedX, clampedY]
      );
    }
  }

  spawnSquadToken(
    type: 'home' | 'away' | 'referee' | 'ball',
    coords?: [number, number],
    customLabel?: string,
    customName?: string
  ) {
    const existing = this.store.entities().filter((e) => e.type === type);
    const defaultLabel =
      type === 'home' || type === 'away'
        ? String(existing.length + 1)
        : type === 'referee'
          ? 'R'
          : undefined;
    const label = customLabel ?? defaultLabel;
    const x = coords ? coords[0] : Math.round(525 + (Math.random() * 60 - 30));
    const y = coords ? coords[1] : Math.round(340 + (Math.random() * 60 - 30));
    const id = this.store.addEntity({
      type,
      x,
      y,
      ...(label ? { label } : {}),
      ...(customName ? { name: customName } : {}),
    });
    this.activeTool.set('move');
    this.selectedEntityId.set(id);
    this.updateDraggable();
    this.showStatus(`Added ${customName ?? type} token`);
  }

  spawnEquipment(kind: EquipmentKind, defaultColor: string, coords?: [number, number]) {
    const x = coords ? coords[0] : 525 + Math.round(Math.random() * 80 - 40);
    const y = coords ? coords[1] : 340 + Math.round(Math.random() * 80 - 40);
    const id = this.store.addEntity({
      type: 'equipment',
      equipmentKind: kind,
      color: defaultColor,
      rotation: 0,
      x,
      y,
    });
    this.activeTool.set('move');
    this.selectedEntityId.set(id);
    this.updateDraggable();
    this.showStatus(`Added ${kind}`);
  }

  updateSelectedMeta(patch: Partial<TacticalEntity>) {
    const id = this.selectedEntityId();
    if (!id) return;
    this.store.updateEntityMeta(id, patch);
  }

  deleteSelectedEntity() {
    const id = this.selectedEntityId();
    if (!id || id === 'ball') return;
    this.store.removeEntity(id);
    this.selectedEntityId.set(null);
    this.showStatus('Removed from pitch');
  }

  // ---- Interactive Feature Tour & Built-in Demos ----
  toggleTour() {
    const next = !this.showTour();
    this.showTour.set(next);
    if (next) this.tourIndex.set(0);
  }

  prevTourStep() {
    this.tourIndex.set(Math.max(0, this.tourIndex() - 1));
  }

  nextTourStep() {
    if (this.tourIndex() >= this.tourSteps.length - 1) {
      this.showTour.set(false);
    } else {
      this.tourIndex.set(this.tourIndex() + 1);
    }
  }

  runTourAction(step: number) {
    if (step === 1) {
      this.onSquadPresetChange('empty');
      this.setPitchView('half-right');
    } else if (step === 2) {
      this.showEquipmentTray.set(true);
      this.spawnSquadToken('home', [740, 260], '9', 'Striker');
      this.spawnSquadToken('away', [880, 340], '4', 'Defender');
      this.spawnEquipment('cone', '#f97316', [790, 300]);
    } else if (step === 3) {
      this.setPitchView(this.pitchView() === 'half-right' ? 'vertical' : 'half-right');
      this.setBoardZoom(1.15);
    } else if (step === 4) {
      this.loadDemoTactic(this.demoTactics[1], false);
    } else if (step === 5) {
      const p10 =
        this.store.entities().find((e) => e.type === 'home' && e.label === '10') ??
        this.store.entities().find((e) => e.type === 'home');
      if (p10) {
        this.selectedEntityId.set(p10.id);
        this.store.updateEntityMeta(p10.id, { showVision: true, facing: 0, name: 'Playmaker' });
        this.showStatus('Vision cone enabled on Playmaker #10');
      }
    } else if (step === 6) {
      this.loadDemoTactic(this.demoTactics[0], true);
    }
  }

  loadDemoTactic(demo: DemoTacticPreset, autoPlay: boolean) {
    if (this.isPlaying()) this.stopPlayback();
    if (
      this.store.importBoard({
        version: 1,
        frames: demo.frames,
        squadPreset: demo.squadPreset,
      })
    ) {
      this.pitchView.set(demo.pitchView);
      setTimeout(() => {
        this.applyStageViewport();
        this.refreshDivisionsLayer();
        this.syncFromStore();
        this.showStatus(`Loaded demo: "${demo.title}"`);
        if (autoPlay) this.play();
      }, 20);
    }
  }

  // ---- Collections, Storage & Share Link ----
  addCurrentToCollections() {
    const updated = saveToCollections(
      this.collectionTitle(),
      this.collectionCategory(),
      this.store.exportBoard()
    );
    this.collections.set(updated);
    this.collectionTitle.set('');
    this.showStatus('Saved scheme to Collections');
  }

  loadFromCollection(item: SavedCollectionItem) {
    if (this.store.importBoard(item.data)) {
      this.syncFromStore();
      this.showStatus(`Loaded "${item.title}"`);
    }
  }

  removeFromCollection(id: string) {
    this.collections.set(deleteFromCollections(id));
  }

  exportJsonFile() {
    const data = JSON.stringify(this.store.exportBoard(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    this.exportService.triggerDownload(blob, 'tactical-board-scheme.json');
    this.showStatus('Exported tactical-board-scheme.json');
  }

  importJsonFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (this.store.importBoard(parsed)) {
          this.syncFromStore();
          this.showStatus(`Imported ${file.name}`);
        } else {
          this.showStatus('Invalid scheme file');
        }
      } catch {
        this.showStatus('Failed to parse JSON file');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  shareSchemeLink() {
    try {
      const hash = encodeSchemeHash(this.store.exportBoard());
      const url = `${window.location.origin}${window.location.pathname}${hash}`;
      window.history.replaceState(null, '', hash);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      this.showStatus('Shareable link copied & updated in URL');
    } catch {
      this.showStatus('Could not generate share link');
    }
  }

  resetBoard() {
    this.store.reset();
    this.selectedEntityId.set(null);
    this.showStatus('Board reset (Ctrl+Z to undo)');
  }

  saveBoard() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store.exportBoard()));
      this.hasSavedBoard.set(true);
      this.showStatus('Board saved');
    } catch {
      this.showStatus('Could not save (storage unavailable)');
    }
  }

  loadBoard() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!this.store.importBoard(data)) {
        this.showStatus('Saved board is corrupted');
        return;
      }
      this.syncFromStore();
      this.showStatus('Board loaded');
    } catch {
      this.showStatus('Saved board is corrupted');
    }
  }

  deleteFrame() {
    if (this.store.frameCount() < 2) return;
    if (confirm(`Delete frame ${this.store.currentFrame() + 1}?`)) this.store.deleteFrame();
  }

  // ---- Timeline Playback & Scrubbing ----
  play() {
    if (this.isPlaying()) return;
    const last = this.store.frameCount() - 1;
    if (last < 1) return;

    this.singleStepOnly = false;
    if (this.store.currentFrame() >= last) this.store.goToFrame(0);
    this.syncFromStore();
    this.playbackTarget = this.store.currentFrame();

    this.isPlaying.set(true);
    this.updateDraggable();
    this.ngZone.runOutsideAngular(() => this.playStep(this.playbackTarget));
  }

  playSingleStep() {
    if (this.isPlaying()) return;
    const last = this.store.frameCount() - 1;
    if (last < 1) return;

    this.singleStepOnly = true;
    const start = this.store.currentFrame() >= last ? 0 : this.store.currentFrame();
    if (start !== this.store.currentFrame()) this.store.goToFrame(start);
    this.syncFromStore();
    this.playbackTarget = start;

    this.isPlaying.set(true);
    this.updateDraggable();
    this.ngZone.runOutsideAngular(() => this.playStep(start));
  }

  stopPlayback() {
    this.activeTweens.forEach((t) => {
      t.pause();
      t.destroy();
    });
    this.activeTweens = [];
    this.drawingLayer.opacity(1);

    this.ngZone.run(() => {
      this.store.goToFrame(this.playbackTarget);
      this.isPlaying.set(false);
      this.updateDraggable();
    });
    this.syncFromStore();
  }

  private playStep(from: number) {
    const frames = this.store.frames();
    const to = from + 1;
    if (to >= frames.length) {
      if (this.loopPlayback() && !this.singleStepOnly && frames.length >= 2) {
        this.ngZone.run(() => this.store.goToFrame(0));
        this.syncFromStore();
        this.playbackTarget = 0;
        this.playStep(0);
        return;
      }
      this.stopPlayback();
      return;
    }
    this.playbackTarget = to;
    this.ngZone.run(() => this.scrubPos.set(to));

    const seconds = this.store.stepDurationMs() / 1000;
    this.ghostLayer.destroyChildren();
    this.ghostLayer.batchDraw();
    this.renderShapes(frames[to].shapes ?? []);
    this.shapesLayer.batchDraw();
    const stepArrows = frames[to].arrows.length > 0 ? frames[to].arrows : frames[from].arrows;
    this.renderArrows(stepArrows);
    this.renderTexts(frames[to].texts ?? [], frames[to].note ?? '');
    renderGoalScoredOverlay(this.drawingLayer, frames[to].entities, this.uprightRotation());
    this.drawingLayer.opacity(frames[to].arrows.length > 0 ? 0 : 1);

    const tweens: Konva.Tween[] = [];
    frames[to].entities.forEach((e) => {
      const node = this.entityLayer.findOne('#' + e.id);
      if (!node || (node.x() === e.x && node.y() === e.y)) return;
      tweens.push(
        new Konva.Tween({
          node,
          duration: seconds,
          x: e.x,
          y: e.y,
          easing: Konva.Easings.EaseInOut,
        })
      );
    });
    tweens.push(
      new Konva.Tween({
        node: this.drawingLayer,
        duration: seconds,
        opacity: 1,
        easing: Konva.Easings.EaseInOut,
        onFinish: () => {
          if (this.singleStepOnly) {
            this.stopPlayback();
          } else {
            this.playStep(to);
          }
        },
      })
    );

    this.activeTweens = tweens;
    tweens.forEach((t) => t.play());
  }

  onScrub(event: Event) {
    const t = parseFloat((event.target as HTMLInputElement).value);
    if (!Number.isFinite(t)) return;
    this.scrubPos.set(t);
    this.previewAt(t);
  }

  onScrubEnd() {
    this.store.goToFrame(Math.round(this.scrubPos()));
    this.syncFromStore();
  }

  private previewAt(t: number) {
    const frames = this.store.frames();
    if (frames.length < 2 || !this.entityLayer) return;

    const i = Math.min(Math.floor(t), frames.length - 2);
    const progress = Konva.Easings.EaseInOut(t - i, 0, 1, 1);
    const next = new Map(frames[i + 1].entities.map((e) => [e.id, e]));

    frames[i].entities.forEach((a) => {
      const b = next.get(a.id);
      const node = this.entityLayer.findOne('#' + a.id);
      if (!b || !node) return;
      node.position({
        x: a.x + (b.x - a.x) * progress,
        y: a.y + (b.y - a.y) * progress,
      });
    });

    const activeIdx = t - i < 0.5 ? i : i + 1;
    const primaryArrows = frames[activeIdx].arrows;
    const fallbackArrows = frames[t - i < 0.5 ? i + 1 : i].arrows;
    this.renderShapes(frames[activeIdx].shapes ?? []);
    this.renderArrows(primaryArrows.length > 0 ? primaryArrows : fallbackArrows);
    this.renderTexts(frames[activeIdx].texts ?? [], frames[activeIdx].note ?? '');
    this.ghostLayer.destroyChildren();
    this.shapesLayer.batchDraw();
    this.ghostLayer.batchDraw();
    this.entityLayer.batchDraw();
    this.drawingLayer.batchDraw();
  }

  // ---- Tool Selection & Cursors ----
  private defaultToolCursor(): string {
    if (this.isPlaying() || this.isExporting()) return 'default';
    const tool = this.activeTool();
    if (tool === 'eraser') return CURSORS.eraser;
    if (tool === 'arrow') return this.arrowStyle() === 'freehand' ? CURSORS.pencil : 'crosshair';
    if (tool === 'shape') return 'crosshair';
    if (tool === 'text') return 'text';
    return 'default';
  }

  private setStageCursor(cursor: string) {
    if (!this.stage) return;
    this.stage.container().style.cursor = cursor;
  }

  private updateDraggable() {
    const isMove = this.activeTool() === 'move' && !this.isPlaying() && !this.isExporting();
    const isEraser = this.activeTool() === 'eraser' && !this.isPlaying() && !this.isExporting();
    if (this.entityLayer) {
      this.entityLayer.listening(isMove || isEraser);
      this.entityLayer.getChildren().forEach((group) => group.draggable(isMove));
    }
    this.setStageCursor(this.defaultToolCursor());
  }

  toggleDrawingMode() {
    this.activeTool.set(this.isDrawingMode() ? 'move' : 'arrow');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
  }

  selectArrowStyle(style: ArrowStyle) {
    this.arrowStyle.set(style);
    this.activeTool.set('arrow');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
  }

  selectShapeTool(kind: ShapeKind) {
    this.shapeKind.set(kind);
    this.activeTool.set('shape');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
  }

  selectTextTool() {
    this.activeTool.set('text');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
    this.showStatus('Click anywhere on the pitch to place text');
  }

  selectEraserTool() {
    this.activeTool.set(this.activeTool() === 'eraser' ? 'move' : 'eraser');
    this.selectedEntityId.set(null);
    this.updateDraggable();
    this.syncFromStore();
    if (this.activeTool() === 'eraser') {
      this.showStatus('Eraser active: click any arrow, zone, text, or equipment to delete it');
    }
  }

  // ---- Export PNG, GIF & MP4 (delegated to BoardExportService) ----
  exportPng() {
    if (!this.stage) return;
    this.exportService.exportPng(
      this.stage,
      () => {
        this.renderArrows(this.store.arrows(), false);
        this.renderTexts(this.store.texts(), this.store.note());
        renderGoalScoredOverlay(this.drawingLayer, this.store.entities(), this.uprightRotation());
      },
      () => this.syncFromStore(),
      (msg) => this.showStatus(msg)
    );
  }

  async exportGif() {
    await this.runVideoExport('gif');
  }

  async exportMp4() {
    await this.runVideoExport('mp4');
  }

  private async runVideoExport(kind: 'mp4' | 'gif') {
    if (this.isExporting() || this.isPlaying() || this.store.frameCount() < 2) return;
    this.isExporting.set(true);
    this.exportKind.set(kind);
    this.exportProgress.set(0);
    this.updateDraggable();

    try {
      await this.exportService.exportVideoOrGif(kind, {
        stage: this.stage,
        entityLayer: this.entityLayer,
        drawingLayer: this.drawingLayer,
        ghostLayer: this.ghostLayer,
        frames: this.store.frames(),
        stepDurationMs: this.store.stepDurationMs(),
        renderFrameState: ({
          entities,
          shapes,
          arrows,
          texts,
          note,
          goalEntities,
          drawingOpacity,
        }) => {
          if (entities) this.syncEntities(entities);
          this.renderShapes(shapes);
          this.renderArrows(arrows, false);
          this.renderTexts(texts, note);
          renderGoalScoredOverlay(this.drawingLayer, goalEntities, this.uprightRotation());
          this.drawingLayer.opacity(drawingOpacity);
        },
        onProgress: (pct) => this.exportProgress.set(pct),
        onStatus: (msg) => this.showStatus(msg),
      });
    } finally {
      this.isExporting.set(false);
      this.updateDraggable();
      this.syncFromStore();
    }
  }

  private showStatus(message: string) {
    this.statusMessage.set(message);
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => this.statusMessage.set(''), 2800);
  }

  // ---- Konva Stage Initialization, Viewport & Drawing Engine ----
  private initCanvas() {
    const container = this.canvasContainer.nativeElement;
    this.stage = new Konva.Stage({
      container,
      width: container.offsetWidth,
      height: container.offsetHeight,
    });

    this.pitchLayer = new Konva.Layer({ listening: false });
    this.divisionsLayer = new Konva.Layer({ visible: false, listening: false });
    this.shapesLayer = new Konva.Layer();
    this.ghostLayer = new Konva.Layer({ listening: false });
    this.drawingLayer = new Konva.Layer();
    this.entityLayer = new Konva.Layer();

    this.stage.add(
      this.pitchLayer,
      this.divisionsLayer,
      this.shapesLayer,
      this.ghostLayer,
      this.drawingLayer,
      this.entityLayer
    );
  }

  private setupResponsiveObserver() {
    const container = this.canvasContainer.nativeElement;
    this.resizeObserver = new ResizeObserver(() => this.applyStageViewport());
    this.resizeObserver.observe(container);
  }

  private applyStageViewport() {
    if (!this.stage || !this.canvasContainer) return;
    const container = this.canvasContainer.nativeElement;
    const cw = container.offsetWidth || FULL_VIEW_W;
    const view = this.pitchView();

    if (view === 'vertical') {
      const scale = cw / FULL_VIEW_H;
      this.stage.width(FULL_VIEW_H * scale);
      this.stage.height(FULL_VIEW_W * scale);
      this.stage.rotation(90);
      this.stage.x((BASE_HEIGHT + PITCH_PAD_Y) * scale);
      this.stage.y(PITCH_PAD_X * scale);
      this.stage.scale({ x: scale, y: scale });
    } else if (view === 'half-left') {
      const scale = cw / HALF_VIEW_W;
      this.stage.width(cw);
      this.stage.height(FULL_VIEW_H * scale);
      this.stage.rotation(0);
      this.stage.x(PITCH_PAD_X * scale);
      this.stage.y(PITCH_PAD_Y * scale);
      this.stage.scale({ x: scale, y: scale });
    } else if (view === 'half-right') {
      const scale = cw / HALF_VIEW_W;
      this.stage.width(cw);
      this.stage.height(FULL_VIEW_H * scale);
      this.stage.rotation(0);
      this.stage.x(-(BASE_WIDTH / 2 - 6) * scale);
      this.stage.y(PITCH_PAD_Y * scale);
      this.stage.scale({ x: scale, y: scale });
    } else {
      const scale = cw / FULL_VIEW_W;
      this.stage.width(FULL_VIEW_W * scale);
      this.stage.height(FULL_VIEW_H * scale);
      this.stage.rotation(0);
      this.stage.x(PITCH_PAD_X * scale);
      this.stage.y(PITCH_PAD_Y * scale);
      this.stage.scale({ x: scale, y: scale });
    }
    this.stage.batchDraw();
  }

  private clampStageDragPos(
    pos: { x: number; y: number },
    margin: number,
    allowGoalNet = false
  ): { x: number; y: number } {
    const absTransform = this.stage.getAbsoluteTransform();
    const inv = absTransform.copy().invert();
    const internal = inv.point(pos);
    const inGoalY =
      allowGoalNet && internal.y >= GOAL_TOP + 6 && internal.y <= GOAL_TOP + GOAL_WIDTH - 6;
    const minX = inGoalY ? -GOAL_DEPTH + 6 : margin;
    const maxX = inGoalY ? BASE_WIDTH + GOAL_DEPTH - 6 : BASE_WIDTH - margin;
    const clamped = {
      x: Math.max(minX, Math.min(maxX, internal.x)),
      y: Math.max(margin, Math.min(BASE_HEIGHT - margin, internal.y)),
    };
    return absTransform.point(clamped);
  }

  private getInternalPointerPos(): [number, number] | null {
    const transform = this.stage.getAbsoluteTransform().copy().invert();
    const pos = this.stage.getPointerPosition();
    if (!pos) return null;
    const mapped = transform.point(pos);
    const inGoalY = mapped.y >= GOAL_TOP && mapped.y <= GOAL_TOP + GOAL_WIDTH;
    const minX = inGoalY ? -GOAL_DEPTH : 0;
    const maxX = inGoalY ? BASE_WIDTH + GOAL_DEPTH : BASE_WIDTH;
    return [
      Math.max(minX, Math.min(maxX, mapped.x)),
      Math.max(0, Math.min(BASE_HEIGHT, mapped.y)),
    ];
  }

  private setupDrawingEngine() {
    this.stage.on('mousedown touchstart', (e) => {
      if (this.isPlaying() || this.isExporting()) return;

      if (this.activeTool() === 'move') {
        if (e.target === this.stage) {
          this.ngZone.run(() => this.selectedEntityId.set(null));
        }
        return;
      }

      if (this.activeTool() === 'eraser' || e.target.name() === 'curve-handle') return;

      const internal = this.getInternalPointerPos();
      if (!internal) return;
      const [internalX, internalY] = internal;

      if (this.activeTool() === 'text') {
        const textVal = this.pendingText().trim();
        if (textVal) {
          this.ngZone.run(() => {
            this.store.addText({
              x: Math.round(internalX),
              y: Math.round(internalY),
              text: textVal,
              fontSize: this.textSize(),
              color: this.drawColor(),
            });
            this.showStatus('Text label placed (drag in Move mode or click in Eraser mode)');
          });
        }
        return;
      }

      this.currentArrowStart = [internalX, internalY];
      this.currentArrowEnd = [internalX, internalY];

      if (this.activeTool() === 'shape') {
        this.currentShape = createShapeNode(
          {
            kind: this.shapeKind(),
            x1: internalX,
            y1: internalY,
            x2: internalX,
            y2: internalY,
            color: this.drawColor(),
          },
          false
        );
        this.shapesLayer.add(this.currentShape);
        return;
      }

      this.freehandPoints = [Math.round(internalX), Math.round(internalY)];
      this.currentArrow = createArrowGroup({
        points: [internalX, internalY, internalX, internalY],
        style: this.arrowStyle(),
        color: this.drawColor(),
        strokeWidth: this.drawWidth(),
        pathPoints: this.freehandPoints,
      });

      this.drawingLayer.add(this.currentArrow);
    });

    this.stage.on('mousemove touchmove', () => {
      if (!this.isDrawingMode()) return;
      const internal = this.getInternalPointerPos();
      if (!internal) return;
      const [internalX, internalY] = internal;

      this.currentArrowEnd = [internalX, internalY];
      const [x1, y1] = this.currentArrowStart;

      if (this.activeTool() === 'shape' && this.currentShape) {
        this.currentShape.destroy();
        this.currentShape = createShapeNode(
          {
            kind: this.shapeKind(),
            x1,
            y1,
            x2: internalX,
            y2: internalY,
            color: this.drawColor(),
          },
          false
        );
        this.shapesLayer.add(this.currentShape);
        this.shapesLayer.batchDraw();
        return;
      }

      if (!this.currentArrow) return;

      if (this.arrowStyle() === 'freehand') {
        const lastX = this.freehandPoints[this.freehandPoints.length - 2];
        const lastY = this.freehandPoints[this.freehandPoints.length - 1];
        if (Math.hypot(internalX - lastX, internalY - lastY) >= 6) {
          this.freehandPoints.push(Math.round(internalX), Math.round(internalY));
        }
      }

      updateArrowGroup(
        this.currentArrow,
        [x1, y1, internalX, internalY],
        this.arrowStyle(),
        undefined,
        this.freehandPoints
      );
      this.drawingLayer.batchDraw();
    });

    this.stage.on('mouseup touchend', () => {
      if (this.activeTool() === 'shape' && this.currentShape) {
        const shape = this.currentShape;
        this.currentShape = null;
        shape.destroy();
        const [x1, y1] = this.currentArrowStart;
        const [x2, y2] = this.currentArrowEnd;
        if (Math.hypot(x2 - x1, y2 - y1) < 12) {
          this.shapesLayer.batchDraw();
          return;
        }
        this.ngZone.run(() =>
          this.store.addShape({
            kind: this.shapeKind(),
            x1: Math.round(x1),
            y1: Math.round(y1),
            x2: Math.round(x2),
            y2: Math.round(y2),
            color: this.drawColor(),
          })
        );
        return;
      }

      const arrow = this.currentArrow;
      if (!arrow) return;
      this.currentArrow = null;

      const [x1, y1] = this.currentArrowStart;
      const [x2, y2] = this.currentArrowEnd;
      arrow.destroy();
      if (Math.hypot(x2 - x1, y2 - y1) < 10 && this.freehandPoints.length < 6) {
        this.drawingLayer.batchDraw();
        return;
      }
      const savedFreehand =
        this.arrowStyle() === 'freehand' ? [...this.freehandPoints] : undefined;
      this.ngZone.run(() =>
        this.store.addArrow(
          [Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2)],
          this.arrowStyle(),
          {
            color: this.drawColor(),
            strokeWidth: this.drawWidth(),
            pathPoints: savedFreehand,
          }
        )
      );
    });
  }

  private syncEntities(entities: TacticalEntity[]) {
    syncEntityNodes(this.entityLayer, entities, {
      activeTool: () => this.activeTool(),
      isPlaying: () => this.isPlaying(),
      isExporting: () => this.isExporting(),
      uprightRotation: () => this.uprightRotation(),
      selectedEntityId: () => this.selectedEntityId(),
      homeColor: () => this.store.homeColor(),
      awayColor: () => this.store.awayColor(),
      defaultToolCursor: () => this.defaultToolCursor(),
      setStageCursor: (c) => this.setStageCursor(c),
      clampStageDragPos: (pos, m, allowNet) => this.clampStageDragPos(pos, m, allowNet),
      onUpdatePosition: (id, x, y) =>
        this.ngZone.run(() => this.store.updatePosition(id, x, y)),
      onRemoveEntity: (id) => this.ngZone.run(() => this.store.removeEntity(id)),
      onSelectEntity: (id) => this.ngZone.run(() => this.selectedEntityId.set(id)),
    });
  }
}
