import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone, ChangeDetectionStrategy, inject, signal, effect, HostListener } from '@angular/core';
import Konva from 'konva';
import { BoardStore } from './board.store';

const STORAGE_KEY = 'tactical-board:v1';

@Component({
  selector: 'app-pitch-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full max-w-5xl mx-auto p-4">
      <!-- Toolbar -->
      <div class="flex flex-wrap gap-4 mb-4">
        <button (click)="toggleDrawingMode()"
                class="px-4 py-2 text-white font-bold rounded shadow-md transition-colors"
                [class.bg-blue-600]="!isDrawingMode()"
                [class.bg-red-600]="isDrawingMode()">
          {{ isDrawingMode() ? 'Stop Drawing (Back to Dragging)' : 'Draw Tactical Arrows' }}
        </button>
        <button (click)="toggleDivisions()"
                class="px-4 py-2 text-white font-bold rounded shadow-md transition-colors"
                [class.bg-gray-700]="!showDivisions()"
                [class.bg-emerald-600]="showDivisions()">
          Pitch Divisions
        </button>
        <button (click)="store.undo()" [disabled]="!store.canUndo()"
                class="px-4 py-2 bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Undo</button>
        <button (click)="store.redo()" [disabled]="!store.canRedo()"
                class="px-4 py-2 bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Redo</button>
        <button (click)="store.clearArrows()" [disabled]="!store.hasArrows()"
                class="px-4 py-2 bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Clear Arrows</button>
        <button (click)="saveBoard()"
                class="px-4 py-2 bg-emerald-700 text-white font-bold rounded shadow-md">Save</button>
        <button (click)="loadBoard()" [disabled]="!hasSavedBoard()"
                class="px-4 py-2 bg-emerald-700 text-white font-bold rounded shadow-md disabled:opacity-40">Load</button>
        <button (click)="resetBoard()"
                class="px-4 py-2 bg-gray-700 text-white font-bold rounded shadow-md">Reset</button>
        @if (statusMessage()) {
          <span class="self-center text-sm text-gray-300">{{ statusMessage() }}</span>
        }
      </div>

      <!-- The Canvas Container -->
      <div class="aspect-[105/68] bg-[#2e7d32] shadow-2xl overflow-hidden rounded-md touch-none select-none" #canvasContainer></div>
    </div>
  `
})
export class PitchBoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  protected store = inject(BoardStore);

  constructor() {
    // Keep Konva nodes in sync with the store (undo/redo/clear, future timeline/AI).
    effect(() => {
      const entities = this.store.entities();
      const arrows = this.store.arrows();
      if (!this.entityLayer) return; // canvas not initialised yet

      entities.forEach(e => {
        const node = this.entityLayer.findOne('#' + e.id);
        if (node && (node.x() !== e.x || node.y() !== e.y)) node.position({ x: e.x, y: e.y });
      });

      this.drawingLayer.destroyChildren();
      arrows.forEach(a => this.drawingLayer.add(this.createArrow(a.points)));
      this.entityLayer.batchDraw();
      this.drawingLayer.batchDraw();
    });
  }

  private createArrow(points: number[]): Konva.Arrow {
    return new Konva.Arrow({
      points,
      pointerLength: 15,
      pointerWidth: 15,
      fill: '#f1c40f',
      stroke: '#f1c40f',
      strokeWidth: 4,
      lineCap: 'round',
      lineJoin: 'round'
    });
  }

  // UI State
  isDrawingMode = signal(false);
  showDivisions = signal(false);
  hasSavedBoard = signal(localStorage.getItem(STORAGE_KEY) !== null);
  statusMessage = signal('');
  private statusTimer?: ReturnType<typeof setTimeout>;

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
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

  resetBoard() {
    this.store.reset();
    this.showStatus('Board reset (Ctrl+Z to undo)');
  }

  saveBoard() {
    try {
      const data = { entities: this.store.entities(), arrows: this.store.arrows() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
      const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

      // Only accept positions for entities that exist on the board
      const saved = new Map<string, { x: number; y: number }>();
      (Array.isArray(data.entities) ? data.entities : []).forEach((e: any) => {
        if (typeof e?.id === 'string' && isNum(e.x) && isNum(e.y)) saved.set(e.id, { x: e.x, y: e.y });
      });
      const entities = this.store.entities().map(e => ({ ...e, ...(saved.get(e.id) ?? {}) }));

      const arrows = (Array.isArray(data.arrows) ? data.arrows : [])
        .filter((a: any) => typeof a?.id === 'string' && Array.isArray(a.points) && a.points.length === 4 && a.points.every(isNum));

      this.store.replaceBoard(entities, arrows);
      this.showStatus('Board loaded');
    } catch {
      this.showStatus('Saved board is corrupted');
    }
  }

  private showStatus(message: string) {
    this.statusMessage.set(message);
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => this.statusMessage.set(''), 2500);
  }

  // Konva Core
  private stage!: Konva.Stage;
  private pitchLayer!: Konva.Layer;
  private drawingLayer!: Konva.Layer;
  private divisionsLayer!: Konva.Layer;
  private entityLayer!: Konva.Layer;
  private resizeObserver!: ResizeObserver;

  // Drawing State
  private currentArrow: Konva.Arrow | null = null;

  private readonly BASE_WIDTH = 1050;
  private readonly BASE_HEIGHT = 680;

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => {
      this.initCanvas();
      this.drawPitch();
      this.drawDivisions();
      this.drawPlayers();
      this.setupDrawingEngine();
      this.setupResponsiveObserver();
    });
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  toggleDrawingMode() {
    this.isDrawingMode.set(!this.isDrawingMode());

    // Disable dragging on all players when drawing mode is active
    this.entityLayer.getChildren().forEach(group => {
      group.draggable(!this.isDrawingMode());
    });
  }

  toggleDivisions() {
    this.showDivisions.set(!this.showDivisions());
    this.divisionsLayer.visible(this.showDivisions());
    this.divisionsLayer.batchDraw();
  }

  /**
   * Tactical zones overlay (hidden by default):
   *  - five vertical channels: wings, half-spaces and the centre (centre = width of the 6-yard box,
   *    half-spaces fill the rest of the penalty-area width)
   *  - attacking thirds
   *  - both penalty areas tinted
   */
  private drawDivisions() {
    const W = this.BASE_WIDTH;
    const H = this.BASE_HEIGHT;
    const centreHalf = 183.2 / 2;     // half the 6-yard box width
    const boxHalf = 403.2 / 2;        // half the penalty-area width
    const cy = H / 2;
    const lanes = [
      0,
      cy - boxHalf,
      cy - centreHalf,
      cy + centreHalf,
      cy + boxHalf,
      H,
    ];
    const laneNames = ['Left wing', 'Left half-space', 'Centre', 'Right half-space', 'Right wing'];
    const dashed = { stroke: 'rgba(255, 255, 255, 0.55)', strokeWidth: 2, dash: [10, 8], listening: false };
    const label = { fontSize: 13, fontFamily: 'sans-serif', fontStyle: 'bold', fill: 'rgba(255, 255, 255, 0.75)', listening: false };

    // Half-space tint (the most valuable channels)
    [[lanes[1], lanes[2]], [lanes[3], lanes[4]]].forEach(([from, to]) => {
      this.divisionsLayer.add(new Konva.Rect({ x: 0, y: from, width: W, height: to - from, fill: 'rgba(255, 235, 59, 0.14)', listening: false }));
    });

    // Penalty areas
    this.divisionsLayer.add(
      new Konva.Rect({ x: 0, y: cy - boxHalf, width: 165, height: 403.2, fill: 'rgba(255, 255, 255, 0.10)', listening: false }),
      new Konva.Rect({ x: W - 165, y: cy - boxHalf, width: 165, height: 403.2, fill: 'rgba(255, 255, 255, 0.10)', listening: false }),
    );

    // Channel lines
    lanes.slice(1, -1).forEach(y => {
      this.divisionsLayer.add(new Konva.Line({ points: [0, y, W, y], ...dashed }));
    });

    // Thirds
    [W / 3, (2 * W) / 3].forEach(x => {
      this.divisionsLayer.add(new Konva.Line({ points: [x, 0, x, H], ...dashed }));
    });
    ['Defensive third', 'Middle third', 'Final third'].forEach((name, i) => {
      this.divisionsLayer.add(new Konva.Text({ text: name, x: (W / 3) * i + 8, y: 8, ...label }));
    });

    // Channel names, placed just outside the left penalty area so they stay clear of the usual player positions
    laneNames.forEach((name, i) => {
      const mid = (lanes[i] + lanes[i + 1]) / 2;
      this.divisionsLayer.add(new Konva.Text({ text: name, x: 215, y: mid - 7, ...label }));
    });
  }

  private initCanvas() {
    const container = this.canvasContainer.nativeElement;
    this.stage = new Konva.Stage({
      container: container,
      width: container.offsetWidth,
      height: container.offsetHeight,
    });

    this.pitchLayer = new Konva.Layer();
    this.divisionsLayer = new Konva.Layer({ visible: false, listening: false }); // zones sit just above the pitch
    this.drawingLayer = new Konva.Layer(); // Sits below players, above pitch
    this.entityLayer = new Konva.Layer();

    this.stage.add(this.pitchLayer);
    this.stage.add(this.divisionsLayer);
    this.stage.add(this.drawingLayer);
    this.stage.add(this.entityLayer);
  }

  private setupResponsiveObserver() {
    const container = this.canvasContainer.nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      const scale = container.offsetWidth / this.BASE_WIDTH;
      this.stage.width(this.BASE_WIDTH * scale);
      this.stage.height(this.BASE_HEIGHT * scale);
      this.stage.scale({ x: scale, y: scale });
    });
    this.resizeObserver.observe(container);
  }

  private setupDrawingEngine() {
    // 1. Start drawing the arrow on mouse/touch down
    this.stage.on('mousedown touchstart', (e) => {
      if (!this.isDrawingMode()) return;

      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      // Divide by scale to map screen pixels to our internal 1050x680 grid
      const scale = this.stage.scaleX();
      const internalX = pos.x / scale;
      const internalY = pos.y / scale;

      this.currentArrow = this.createArrow([internalX, internalY, internalX, internalY]);

      this.drawingLayer.add(this.currentArrow);
    });

    // 2. Stretch the arrow as the mouse moves
    this.stage.on('mousemove touchmove', () => {
      if (!this.isDrawingMode() || !this.currentArrow) return;

      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      const scale = this.stage.scaleX();
      const internalX = pos.x / scale;
      const internalY = pos.y / scale;

      // Update the end coordinates of the arrow
      const points = this.currentArrow.points();
      this.currentArrow.points([points[0], points[1], internalX, internalY]);
    });

    // 3. Finish drawing on mouse up
    this.stage.on('mouseup touchend', () => {
      const arrow = this.currentArrow;
      if (!arrow) return;
      this.currentArrow = null;

      const [x1, y1, x2, y2] = arrow.points();
      arrow.destroy(); // the store-driven effect re-renders committed arrows
      if (Math.hypot(x2 - x1, y2 - y1) < 10) {
        this.drawingLayer.batchDraw();
        return; // ignore accidental taps
      }
      this.ngZone.run(() => this.store.addArrow([x1, y1, x2, y2]));
    });
  }

  private drawPitch() {
    const lineConfig = { stroke: 'rgba(255, 255, 255, 0.7)', strokeWidth: 3, listening: false };

    const boundary = new Konva.Rect({ x: 0, y: 0, width: this.BASE_WIDTH, height: this.BASE_HEIGHT, ...lineConfig });
    const halfwayLine = new Konva.Line({ points: [this.BASE_WIDTH / 2, 0, this.BASE_WIDTH / 2, this.BASE_HEIGHT], ...lineConfig });
    const centerCircle = new Konva.Circle({ x: this.BASE_WIDTH / 2, y: this.BASE_HEIGHT / 2, radius: 91.5, ...lineConfig });
    const leftBox = new Konva.Rect({ x: 0, y: (this.BASE_HEIGHT - 403.2) / 2, width: 165, height: 403.2, ...lineConfig });
    const rightBox = new Konva.Rect({ x: this.BASE_WIDTH - 165, y: (this.BASE_HEIGHT - 403.2) / 2, width: 165, height: 403.2, ...lineConfig });
    const leftGoalArea = new Konva.Rect({ x: 0, y: (this.BASE_HEIGHT - 183.2) / 2, width: 55, height: 183.2, ...lineConfig });
    const rightGoalArea = new Konva.Rect({ x: this.BASE_WIDTH - 55, y: (this.BASE_HEIGHT - 183.2) / 2, width: 55, height: 183.2, ...lineConfig });

    this.pitchLayer.add(boundary, halfwayLine, centerCircle, leftBox, rightBox, leftGoalArea, rightGoalArea);
  }

  /** Classic black & white football: white sphere, black centre pentagon, surrounding patches. */
  private addClassicBall(group: Konva.Group, r: number) {
    group.add(new Konva.Circle({ radius: r, fill: '#ffffff', stroke: '#111111', strokeWidth: 1.5 }));

    // Pattern is clipped to the sphere so outer pentagons are cut by the edge (3D look)
    const pattern = new Konva.Group({
      clipFunc: (ctx) => { ctx.arc(0, 0, r, 0, Math.PI * 2, false); }
    });
    const black = '#111111';
    const rad = (deg: number) => deg * Math.PI / 180;
    const pt = (deg: number, dist: number) => ({ x: Math.cos(rad(deg)) * dist, y: Math.sin(rad(deg)) * dist });

    for (let i = 0; i < 5; i++) {
      const a = i * 72 - 90;          // direction of a centre-pentagon vertex
      const next = a + 72;
      const inner = pt(a, r * 0.38);
      const outer = pt(a, r * 0.78);
      const outerNext = pt(next, r * 0.78);
      const mid = pt(a + 36, r * 0.62);

      // Seam from each centre-pentagon corner out to the outer pentagon
      pattern.add(new Konva.Line({ points: [inner.x, inner.y, outer.x, outer.y], stroke: black, strokeWidth: 1 }));
      // Hexagon outline between neighbouring outer pentagons
      pattern.add(new Konva.Line({
        points: [outer.x, outer.y, mid.x, mid.y, outerNext.x, outerNext.y],
        stroke: black, strokeWidth: 1, lineJoin: 'round',
      }));
      // Outer pentagon, pushed to the rim and cut by the clip
      const rim = pt(a, r * 1.02);
      pattern.add(new Konva.RegularPolygon({
        x: rim.x, y: rim.y, sides: 5, radius: r * 0.42,
        rotation: a + 90 + 180, // point toward the centre
        fill: black,
      }));
    }

    // Centre pentagon
    pattern.add(new Konva.RegularPolygon({ sides: 5, radius: r * 0.38, fill: black }));
    group.add(pattern);

    // Outline drawn on top so the clipped edge stays crisp
    group.add(new Konva.Circle({ radius: r, stroke: black, strokeWidth: 1.5 }));
  }

  private drawPlayers() {
    const entities = this.store.entities();

    entities.forEach(entity => {
      const isBall = entity.type === 'ball';
      const radius = isBall ? 13 : 15;

      const group = new Konva.Group({
        id: entity.id,
        x: entity.x,
        y: entity.y,
        draggable: true,
        dragBoundFunc: (pos) => {
          const scale = this.stage.scaleX();
          const minX = radius * scale;
          const maxX = (this.BASE_WIDTH * scale) - (radius * scale);
          const minY = radius * scale;
          const maxY = (this.BASE_HEIGHT * scale) - (radius * scale);
          return { x: Math.max(minX, Math.min(pos.x, maxX)), y: Math.max(minY, Math.min(pos.y, maxY)) };
        }
      });

      if (isBall) {
        this.addClassicBall(group, radius);
      } else {
        group.add(new Konva.Circle({
          radius: radius,
          fill: entity.type === 'home' ? '#e74c3c' : '#3498db',
          stroke: entity.type === 'home' ? '#c0392b' : '#2980b9',
          strokeWidth: 2,
        }));
      }

      if (!isBall && entity.label) {
        const text = new Konva.Text({
          text: entity.label,
          fontSize: 14,
          fontFamily: 'sans-serif',
          fill: '#ffffff',
          fontStyle: 'bold',
          width: radius * 2,
          height: radius * 2,
          offsetX: radius,
          offsetY: radius,
          align: 'center',
          verticalAlign: 'middle'
        });
        group.add(text);
      }

      group.on('mouseenter', () => { if (!this.isDrawingMode()) this.stage.container().style.cursor = 'grab'; });
      group.on('mouseleave', () => { if (!this.isDrawingMode()) this.stage.container().style.cursor = 'default'; });
      group.on('mousedown', () => { if (!this.isDrawingMode()) this.stage.container().style.cursor = 'grabbing'; });
      group.on('mouseup', () => { if (!this.isDrawingMode()) this.stage.container().style.cursor = 'grab'; });

      group.on('dragend', () => {
        const newPos = group.position();
        this.ngZone.run(() => this.store.updatePosition(entity.id, Math.round(newPos.x), Math.round(newPos.y)));
      });

      this.entityLayer.add(group);
    });
  }
}
