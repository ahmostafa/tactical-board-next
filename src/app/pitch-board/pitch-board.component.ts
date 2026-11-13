import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone, ChangeDetectionStrategy, inject, signal, effect } from '@angular/core';
import Konva from 'konva';
import { BoardStore } from './board.store';

@Component({
  selector: 'app-pitch-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full max-w-5xl mx-auto p-4">
      <!-- Toolbar -->
      <div class="flex gap-4 mb-4">
        <button (click)="toggleDrawingMode()"
                class="px-4 py-2 text-white font-bold rounded shadow-md transition-colors"
                [class.bg-blue-600]="!isDrawingMode()"
                [class.bg-red-600]="isDrawingMode()">
          {{ isDrawingMode() ? 'Stop Drawing (Back to Dragging)' : 'Draw Tactical Arrows' }}
        </button>
        <button (click)="store.undo()" [disabled]="!store.canUndo()"
                class="px-4 py-2 bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Undo</button>
        <button (click)="store.redo()" [disabled]="!store.canRedo()"
                class="px-4 py-2 bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Redo</button>
        <button (click)="store.clearArrows()" [disabled]="!store.hasArrows()"
                class="px-4 py-2 bg-gray-700 text-white font-bold rounded shadow-md disabled:opacity-40">Clear Arrows</button>
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

  // Konva Core
  private stage!: Konva.Stage;
  private pitchLayer!: Konva.Layer;
  private drawingLayer!: Konva.Layer;
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

  private initCanvas() {
    const container = this.canvasContainer.nativeElement;
    this.stage = new Konva.Stage({
      container: container,
      width: container.offsetWidth,
      height: container.offsetHeight,
    });

    this.pitchLayer = new Konva.Layer();
    this.drawingLayer = new Konva.Layer(); // Sits below players, above pitch
    this.entityLayer = new Konva.Layer();

    this.stage.add(this.pitchLayer);
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
