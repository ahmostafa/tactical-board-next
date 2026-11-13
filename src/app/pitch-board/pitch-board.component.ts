import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone, ChangeDetectionStrategy, inject, signal, effect, computed, HostListener } from '@angular/core';
import Konva from 'konva';
import { BoardStore, TacticalEntity, TacticalArrow, ArrowStyle } from './board.store';

const STORAGE_KEY = 'tactical-board:v1';

@Component({
  selector: 'app-pitch-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full max-w-5xl mx-auto p-4">
      <!-- Toolbar -->
      <fieldset class="flex flex-wrap gap-4 mb-4 border-0 p-0 m-0 min-w-0" [disabled]="isPlaying() || isExporting()">
        <button (click)="toggleDrawingMode()"
                class="px-4 py-2 text-white font-bold rounded shadow-md transition-colors"
                [class.bg-blue-600]="!isDrawingMode()"
                [class.bg-red-600]="isDrawingMode()">
          {{ isDrawingMode() ? 'Stop Drawing (Back to Dragging)' : 'Draw Tactical Arrows' }}
        </button>
        <div class="inline-flex rounded shadow-md overflow-hidden" role="group" aria-label="Arrow style">
          <button (click)="selectArrowStyle('pass')"
                  class="px-3 py-2 text-xs font-bold text-white transition-colors"
                  [class.bg-amber-600]="arrowStyle() === 'pass'"
                  [class.bg-gray-700]="arrowStyle() !== 'pass'"
                  title="Solid arrow for passes">Pass</button>
          <button (click)="selectArrowStyle('run')"
                  class="px-3 py-2 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-amber-600]="arrowStyle() === 'run'"
                  [class.bg-gray-700]="arrowStyle() !== 'run'"
                  title="Dashed arrow for off-the-ball runs">Run</button>
          <button (click)="selectArrowStyle('dribble')"
                  class="px-3 py-2 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-amber-600]="arrowStyle() === 'dribble'"
                  [class.bg-gray-700]="arrowStyle() !== 'dribble'"
                  title="Wavy arrow for ball carrier dribbles">Dribble</button>
          <button (click)="selectArrowStyle('zone')"
                  class="px-3 py-2 text-xs font-bold text-white border-l border-gray-600 transition-colors"
                  [class.bg-amber-600]="arrowStyle() === 'zone'"
                  [class.bg-gray-700]="arrowStyle() !== 'zone'"
                  title="Arrow pointing into a highlighted empty space / target zone">Target Zone</button>
        </div>
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
      </fieldset>

      <!-- The Canvas Container -->
      <div class="aspect-[105/68] bg-[#2e7d32] shadow-2xl overflow-hidden rounded-md touch-none select-none" #canvasContainer></div>

      <!-- Timeline -->
      <div class="mt-4 p-3 rounded-md bg-gray-800 text-white flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <button (click)="isPlaying() ? stopPlayback() : play()"
                  [disabled]="isExporting() || (!isPlaying() && store.frameCount() < 2)"
                  class="px-4 py-2 font-bold rounded shadow-md disabled:opacity-40"
                  [class.bg-blue-600]="!isPlaying()"
                  [class.bg-red-600]="isPlaying()">
            {{ isPlaying() ? 'Stop' : 'Play' }}
          </button>

          <fieldset class="flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0" [disabled]="isPlaying() || isExporting()">
            <button (click)="store.goToFrame(store.currentFrame() - 1)" [disabled]="store.currentFrame() === 0"
                    class="px-3 py-2 bg-gray-700 rounded disabled:opacity-40" aria-label="Previous frame">&lt;</button>
            @for (i of frameIndexes(); track i) {
              <button (click)="store.goToFrame(i)"
                      class="min-w-9 px-3 py-2 rounded font-bold text-sm"
                      [class.bg-emerald-600]="i === store.currentFrame()"
                      [class.bg-gray-700]="i !== store.currentFrame()">{{ i + 1 }}</button>
            }
            <button (click)="store.goToFrame(store.currentFrame() + 1)"
                    [disabled]="store.currentFrame() >= store.frameCount() - 1"
                    class="px-3 py-2 bg-gray-700 rounded disabled:opacity-40" aria-label="Next frame">&gt;</button>

            <button (click)="store.addFrame()" class="px-3 py-2 bg-blue-700 rounded text-sm font-bold"
                    title="New step with the same positions and no arrows">+ Frame</button>
            <button (click)="store.duplicateFrame()" class="px-3 py-2 bg-gray-700 rounded text-sm font-bold"
                    title="Copy this step including its arrows">Duplicate</button>
            <button (click)="deleteFrame()" [disabled]="store.frameCount() < 2"
                    class="px-3 py-2 bg-gray-700 rounded text-sm font-bold disabled:opacity-40">Delete</button>
            <button (click)="exportMp4()" [disabled]="store.frameCount() < 2"
                    class="px-3 py-2 bg-purple-700 hover:bg-purple-600 rounded text-sm font-bold disabled:opacity-40"
                    title="Render the timeline into a downloadable MP4 video">
              {{ isExporting() ? 'Exporting (' + exportProgress() + '%)' : 'Export MP4' }}
            </button>
          </fieldset>
        </div>

        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <label class="flex items-center gap-2 grow min-w-48">
            Scrub
            <input type="range" class="w-full" min="0" step="0.01"
                   [max]="store.frameCount() - 1" [value]="scrubPos()"
                   [disabled]="isPlaying() || isExporting() || store.frameCount() < 2"
                   (input)="onScrub($event)" (change)="onScrubEnd()" />
          </label>
          <label class="flex items-center gap-2">
            Step {{ (store.stepDurationMs() / 1000).toFixed(1) }}s
            <input type="range" min="300" max="3000" step="100" [value]="store.stepDurationMs()"
                   (input)="store.setStepDuration(+$any($event.target).value)" />
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" [checked]="showGhost()" (change)="showGhost.set(!showGhost())" />
            Ghost previous frame
          </label>
        </div>
      </div>
    </div>
  `
})
export class PitchBoardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') canvasContainer!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  protected store = inject(BoardStore);

  constructor() {
    // Keep Konva nodes in sync with the store (undo/redo, frame changes, load, reset).
    // While the animation plays, Konva drives the nodes itself.
    effect(() => {
      this.showGhost();
      if (this.isPlaying() || this.isExporting()) return;
      this.syncFromStore();
    });
  }

  /** Makes the canvas match the store: positions, arrows of the current frame and the ghost frame. */
  private syncFromStore() {
    const entities = this.store.entities();
    const arrows = this.store.arrows();
    const frames = this.store.frames();
    const current = this.store.currentFrame();
    const ghost = this.showGhost();
    if (!this.entityLayer) return; // canvas not initialised yet

    entities.forEach(e => {
      const node = this.entityLayer.findOne('#' + e.id);
      if (node && (node.x() !== e.x || node.y() !== e.y)) node.position({ x: e.x, y: e.y });
    });

    this.renderArrows(arrows, !this.isPlaying() && !this.isExporting());
    this.drawingLayer.opacity(1);
    this.renderGhost(ghost && current > 0 ? frames[current - 1].entities : null, entities);
    this.scrubPos.set(current);

    this.entityLayer.batchDraw();
    this.drawingLayer.batchDraw();
    this.ghostLayer.batchDraw();
  }

  private renderArrows(arrows: TacticalArrow[], showHandles = false) {
    this.drawingLayer.destroyChildren();
    arrows.forEach(a => {
      const arrowGroup = this.createArrow(a);
      this.drawingLayer.add(arrowGroup);

      if (showHandles) {
        const [x1, y1, x2, y2] = a.points;
        const [cx, cy] = a.controlPoint ?? [(x1 + x2) / 2, (y1 + y2) / 2];
        const handle = new Konva.Circle({
          name: 'curve-handle',
          x: cx,
          y: cy,
          radius: 6,
          fill: '#ffffff',
          stroke: '#f1c40f',
          strokeWidth: 2,
          opacity: 0.85,
          draggable: true,
          dragBoundFunc: (pos) => {
            const scale = this.stage.scaleX();
            return {
              x: Math.max(6 * scale, Math.min(pos.x, (this.BASE_WIDTH - 6) * scale)),
              y: Math.max(6 * scale, Math.min(pos.y, (this.BASE_HEIGHT - 6) * scale)),
            };
          },
        });
        handle.on('mouseenter', () => { this.stage.container().style.cursor = 'grab'; });
        handle.on('mouseleave', () => {
          this.stage.container().style.cursor = this.isDrawingMode() ? 'crosshair' : 'default';
        });
        handle.on('dragmove', () => {
          const p = handle.position();
          this.updateArrowGroup(arrowGroup, a.points, a.style ?? 'pass', [p.x, p.y]);
        });
        handle.on('dragend', () => {
          const p = handle.position();
          this.ngZone.run(() =>
            this.store.updateArrowControl(a.id, [Math.round(p.x), Math.round(p.y)])
          );
        });
        this.drawingLayer.add(handle);
      }
    });
  }

  /** Faded tokens and dashed trails showing where each piece stood in the previous frame. */
  private renderGhost(previous: TacticalEntity[] | null, current: TacticalEntity[]) {
    this.ghostLayer.destroyChildren();
    if (!previous) return;

    previous.forEach(p => {
      const now = current.find(e => e.id === p.id);
      if (!now || Math.hypot(now.x - p.x, now.y - p.y) < 4) return;

      const isBall = p.type === 'ball';
      const color = p.type === 'home' ? '#e74c3c' : p.type === 'away' ? '#3498db' : '#ffffff';
      this.ghostLayer.add(new Konva.Arrow({
        points: [p.x, p.y, now.x, now.y],
        stroke: 'rgba(255, 255, 255, 0.55)',
        fill: 'rgba(255, 255, 255, 0.55)',
        strokeWidth: 2,
        dash: [8, 6],
        pointerLength: 8,
        pointerWidth: 8,
        listening: false,
      }));
      this.ghostLayer.add(new Konva.Circle({
        x: p.x, y: p.y,
        radius: isBall ? 13 : 15,
        fill: color,
        opacity: 0.3,
        stroke: '#ffffff',
        strokeWidth: 1,
        dash: [4, 3],
        listening: false,
      }));
    });
  }

  private readonly ZONE_RADIUS = 28;

  private createArrow(arrow: Pick<TacticalArrow, 'points' | 'style' | 'controlPoint'>): Konva.Group {
    const style = arrow.style ?? 'pass';
    const group = new Konva.Group({ listening: false });

    if (style === 'zone') {
      const [, , x2, y2] = arrow.points;
      group.add(new Konva.Circle({
        name: 'zone-outer',
        x: x2,
        y: y2,
        radius: this.ZONE_RADIUS,
        fill: 'rgba(241, 196, 15, 0.20)',
        stroke: '#f1c40f',
        strokeWidth: 2.5,
        dash: [8, 5],
        listening: false,
      }));
      group.add(new Konva.Circle({
        name: 'zone-inner',
        x: x2,
        y: y2,
        radius: 5,
        fill: 'rgba(241, 196, 15, 0.55)',
        listening: false,
      }));
    }

    const pathPoints = this.computeArrowPath(arrow.points, style, arrow.controlPoint);
    group.add(new Konva.Arrow({
      name: 'arrow-line',
      points: pathPoints,
      pointerLength: 15,
      pointerWidth: 15,
      fill: '#f1c40f',
      stroke: '#f1c40f',
      strokeWidth: 4,
      dash: style === 'run' || style === 'zone' ? [12, 8] : undefined,
      tension: style === 'dribble' ? 0.35 : 0,
      lineCap: 'round',
      lineJoin: 'round',
      listening: false,
    }));

    return group;
  }

  private updateArrowGroup(
    group: Konva.Group,
    points: [number, number, number, number],
    style: ArrowStyle,
    controlPoint?: [number, number]
  ) {
    const line = group.findOne<Konva.Arrow>('.arrow-line');
    if (line) {
      line.points(this.computeArrowPath(points, style, controlPoint));
    }
    if (style === 'zone') {
      const [, , x2, y2] = points;
      group.findOne('.zone-outer')?.position({ x: x2, y: y2 });
      group.findOne('.zone-inner')?.position({ x: x2, y: y2 });
    }
  }

  /** Computes sampled points along a straight/curved line, adding sine waves for dribbles. */
  private computeArrowPath(
    points: [number, number, number, number],
    style: ArrowStyle,
    controlPoint?: [number, number]
  ): number[] {
    const [x1, y1, rawX2, rawY2] = points;
    const rawDist = Math.hypot(rawX2 - x1, rawY2 - y1);
    if (rawDist < 2) return [x1, y1, rawX2, rawY2];

    const mx = (x1 + rawX2) / 2;
    const my = (y1 + rawY2) / 2;
    const [cx, cy] = controlPoint ?? [mx, my];
    const isCurved = Math.hypot(cx - mx, cy - my) > 1.5;

    // Quadratic Bezier control point so the curve passes directly through the handle (cx, cy) at t = 0.5
    const qx = 2 * cx - 0.5 * (x1 + rawX2);
    const qy = 2 * cy - 0.5 * (y1 + rawY2);

    // For 'zone', stop the arrow tip right at the rim of the target zone circle so it points cleanly into the space
    const endT = style === 'zone' && rawDist > this.ZONE_RADIUS + 12
      ? Math.max(0.25, 1 - (this.ZONE_RADIUS - 2) / rawDist)
      : 1;

    const pointAt = (t: number): [number, number] => {
      const s = t * endT;
      if (!isCurved) return [x1 + (rawX2 - x1) * s, y1 + (rawY2 - y1) * s];
      const u = 1 - s;
      return [
        u * u * x1 + 2 * u * s * qx + s * s * rawX2,
        u * u * y1 + 2 * u * s * qy + s * s * rawY2,
      ];
    };

    const tangentAt = (t: number): [number, number] => {
      const s = t * endT;
      const dx = isCurved ? 2 * (1 - s) * (qx - x1) + 2 * s * (rawX2 - qx) : rawX2 - x1;
      const dy = isCurved ? 2 * (1 - s) * (qy - y1) + 2 * s * (rawY2 - qy) : rawY2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      return [dx / len, dy / len];
    };

    if (style === 'dribble') {
      const waveLen = 20;
      const amp = 5.5;
      const cycles = Math.max(2, Math.round(rawDist / waveLen));
      const steps = cycles * 6;
      const out: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const [bx, by] = pointAt(t);
        // Keep the last 18px straight so the arrowhead points cleanly in the travel direction
        const fade = t > 0.85 ? Math.max(0, (1 - t) / 0.15) : Math.min(1, t / 0.08);
        const offset = Math.sin(t * cycles * Math.PI * 2) * amp * fade;
        const [tx, ty] = tangentAt(t);
        out.push(bx - ty * offset, by + tx * offset);
      }
      return out;
    }

    if (!isCurved) {
      const [ex, ey] = pointAt(1);
      return [x1, y1, ex, ey];
    }

    const steps = 20;
    const out: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const [bx, by] = pointAt(i / steps);
      out.push(bx, by);
    }
    return out;
  }

  // UI State
  isDrawingMode = signal(false);
  arrowStyle = signal<ArrowStyle>('pass');
  showDivisions = signal(false);
  showGhost = signal(true);
  isPlaying = signal(false);
  isExporting = signal(false);
  exportProgress = signal(0);
  private ffmpegCore?: any;
  scrubPos = signal(0);
  protected frameIndexes = computed(() => Array.from({ length: this.store.frameCount() }, (_, i) => i));
  hasSavedBoard = signal(localStorage.getItem(STORAGE_KEY) !== null);
  statusMessage = signal('');
  private statusTimer?: ReturnType<typeof setTimeout>;

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (this.isPlaying() || this.isExporting()) return;

    // Frame navigation (ignored while a slider/input has focus so it keeps its own arrow-key behaviour)
    if (!(event.target instanceof HTMLInputElement)) {
      if (event.key === 'ArrowLeft') { this.store.goToFrame(this.store.currentFrame() - 1); return; }
      if (event.key === 'ArrowRight') { this.store.goToFrame(this.store.currentFrame() + 1); return; }
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

  resetBoard() {
    this.store.reset();
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

  // ---- Timeline playback ----
  private activeTweens: Konva.Tween[] = [];
  private playbackTarget = 0;

  play() {
    if (this.isPlaying()) return;
    const last = this.store.frameCount() - 1;
    if (last < 1) return;

    // Start from the current frame, or from the beginning if we're already at the end
    if (this.store.currentFrame() >= last) this.store.goToFrame(0);
    this.syncFromStore();
    this.playbackTarget = this.store.currentFrame();

    this.isPlaying.set(true);
    this.updateDraggable();
    this.ngZone.runOutsideAngular(() => this.playStep(this.playbackTarget));
  }

  stopPlayback() {
    this.activeTweens.forEach(t => { t.pause(); t.destroy(); });
    this.activeTweens = [];
    this.drawingLayer.opacity(1);

    // Stay on the frame we were heading to; the sync effect then snaps everything to it
    this.ngZone.run(() => {
      this.store.goToFrame(this.playbackTarget);
      this.isPlaying.set(false);
      this.updateDraggable();
    });
    this.syncFromStore();
  }

  /** Animates one transition (from -> from + 1): pieces glide, the next frame's arrows fade in. */
  private playStep(from: number) {
    const frames = this.store.frames();
    const to = from + 1;
    if (to >= frames.length) {
      this.stopPlayback();
      return;
    }
    this.playbackTarget = to;
    this.ngZone.run(() => this.scrubPos.set(to));

    const seconds = this.store.stepDurationMs() / 1000;
    this.ghostLayer.destroyChildren();
    this.ghostLayer.batchDraw();
    this.renderArrows(frames[to].arrows);
    this.drawingLayer.opacity(0);

    const tweens: Konva.Tween[] = [];
    frames[to].entities.forEach(e => {
      const node = this.entityLayer.findOne('#' + e.id);
      if (!node || (node.x() === e.x && node.y() === e.y)) return;
      tweens.push(new Konva.Tween({ node, duration: seconds, x: e.x, y: e.y, easing: Konva.Easings.EaseInOut }));
    });
    // The arrow layer's fade also acts as the step clock
    tweens.push(new Konva.Tween({
      node: this.drawingLayer,
      duration: seconds,
      opacity: 1,
      easing: Konva.Easings.EaseInOut,
      onFinish: () => this.playStep(to),
    }));

    this.activeTweens = tweens;
    tweens.forEach(t => t.play());
  }

  private updateDraggable() {
    const draggable = !this.isDrawingMode() && !this.isPlaying() && !this.isExporting();
    if (this.entityLayer) {
      this.entityLayer.listening(draggable);
      this.entityLayer.getChildren().forEach(group => group.draggable(draggable));
    }
    if (this.stage) {
      this.stage.container().style.cursor = this.isDrawingMode() ? 'crosshair' : 'default';
    }
  }

  selectArrowStyle(style: ArrowStyle) {
    this.arrowStyle.set(style);
    if (!this.isDrawingMode()) {
      this.isDrawingMode.set(true);
      this.updateDraggable();
    }
  }

  // ---- Client-side MP4 video export via FFmpeg.wasm ----
  async exportMp4() {
    if (this.isExporting() || this.isPlaying() || this.store.frameCount() < 2) return;
    this.isExporting.set(true);
    this.exportProgress.set(0);
    this.updateDraggable();
    this.showStatus('Loading FFmpeg.wasm...');

    const writtenFiles: string[] = [];
    try {
      if (!this.ffmpegCore) {
        // @ts-ignore - @ffmpeg/core does not ship .d.ts files
        const mod: any = await import('@ffmpeg/core');
        const createFFmpegCore = mod.default ?? mod;
        const wasmUrl = new URL('@ffmpeg/core/wasm', import.meta.url).href;
        const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
        this.ffmpegCore = await createFFmpegCore({ wasmBinary });
      }
      const core = this.ffmpegCore;

      const frames = this.store.frames();
      const fps = 30;
      const framesPerStep = Math.max(6, Math.round((this.store.stepDurationMs() / 1000) * fps));
      const holdStart = Math.round(fps * 0.4);
      const holdEnd = Math.round(fps * 0.6);
      const totalTransitions = frames.length - 1;
      const totalVideoFrames = holdStart + totalTransitions * framesPerStep + holdEnd;

      this.ghostLayer.destroyChildren();
      this.ghostLayer.batchDraw();

      const capturePng = (idx: number) => {
        this.stage.draw();
        const scale = this.stage.scaleX() || 1;
        const dataUrl = this.stage.toDataURL({
          pixelRatio: 1 / scale,
          mimeType: 'image/png',
        });
        const base64 = dataUrl.split(',')[1];
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
        const name = `f_${String(idx).padStart(4, '0')}.png`;
        core.FS.writeFile(name, bytes);
        writtenFiles.push(name);
      };

      let frameIdx = 0;

      // 1. Render initial keyframe hold
      frames[0].entities.forEach(e => {
        const node = this.entityLayer.findOne('#' + e.id);
        if (node) node.position({ x: e.x, y: e.y });
      });
      this.renderArrows(frames[0].arrows);
      this.drawingLayer.opacity(1);
      this.entityLayer.batchDraw();
      this.drawingLayer.batchDraw();

      for (let h = 0; h < holdStart; h++) {
        capturePng(frameIdx++);
      }
      this.exportProgress.set(Math.round((frameIdx / totalVideoFrames) * 60));
      this.showStatus('Rendering tactical animation frames...');
      await new Promise(r => setTimeout(r, 0));

      // 2. Render interpolated transition steps
      for (let step = 0; step < totalTransitions; step++) {
        const fromFrame = frames[step];
        const toFrame = frames[step + 1];
        const nextMap = new Map(toFrame.entities.map(e => [e.id, e]));
        this.renderArrows(toFrame.arrows);

        for (let f = 1; f <= framesPerStep; f++) {
          const linear = f / framesPerStep;
          const progress = Konva.Easings.EaseInOut(linear, 0, 1, 1);
          fromFrame.entities.forEach(a => {
            const b = nextMap.get(a.id);
            const node = this.entityLayer.findOne('#' + a.id);
            if (b && node) {
              node.position({ x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress });
            }
          });
          this.drawingLayer.opacity(progress);
          this.entityLayer.batchDraw();
          this.drawingLayer.batchDraw();

          capturePng(frameIdx++);
          if (f % 5 === 0) {
            this.exportProgress.set(Math.round((frameIdx / totalVideoFrames) * 60));
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }

      // 3. Hold final frame
      this.drawingLayer.opacity(1);
      this.drawingLayer.batchDraw();
      for (let h = 0; h < holdEnd; h++) {
        capturePng(frameIdx++);
      }

      // 4. Encode MP4 in FFmpeg.wasm
      this.showStatus('Encoding MP4 video...');
      this.exportProgress.set(65);
      await new Promise(r => setTimeout(r, 20));

      core.setProgress(({ progress }: { progress: number }) => {
        if (Number.isFinite(progress)) {
          this.ngZone.run(() =>
            this.exportProgress.set(Math.min(99, 65 + Math.round(Math.max(0, Math.min(1, progress)) * 34)))
          );
        }
      });

      const runExec = (args: string[]) => {
        core.setTimeout(-1);
        core.exec(...args);
        const ret = core.ret;
        core.reset();
        return ret;
      };

      try { core.FS.unlink('tactical-board.mp4'); } catch {}

      const durationSec = (frameIdx / fps).toFixed(3);
      const vf =
        'scale=1280:720:force_original_aspect_ratio=decrease:flags=lanczos,' +
        'pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#111827,' +
        'setsar=1,format=yuv420p';

      const ret = runExec([
        '-framerate', String(fps),
        '-i', 'f_%04d.png',
        '-f', 'lavfi',
        '-t', durationSec,
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-profile:v', 'main',
        '-level', '3.1',
        '-bf', '0',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-colorspace', 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-color_range', 'tv',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-shortest',
        '-brand', 'mp42',
        '-movflags', '+faststart',
        'tactical-board.mp4',
      ]);
      if (ret !== 0) {
        try { core.FS.unlink('tactical-board.mp4'); } catch {}
        runExec([
          '-framerate', String(fps),
          '-i', 'f_%04d.png',
          '-vf', vf,
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-profile:v', 'baseline',
          '-level', '3.0',
          '-pix_fmt', 'yuv420p',
          '-brand', 'mp42',
          '-movflags', '+faststart',
          'tactical-board.mp4',
        ]);
      }

      const data: Uint8Array = core.FS.readFile('tactical-board.mp4', { encoding: 'binary' });
      writtenFiles.push('tactical-board.mp4');
      if (!data || data.byteLength < 256) {
        throw new Error(`Encoded MP4 is empty (${data?.byteLength ?? 0} bytes)`);
      }
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      const blob = new Blob([copy.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tactical-board.mp4';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      this.exportProgress.set(100);
      this.showStatus('MP4 exported (tactical-board.mp4)');
    } catch (err) {
      console.error('MP4 export failed:', err);
      this.showStatus('MP4 export failed');
    } finally {
      if (this.ffmpegCore) {
        for (const f of writtenFiles) {
          try { this.ffmpegCore.FS.unlink(f); } catch {}
        }
      }
      this.isExporting.set(false);
      this.updateDraggable();
      this.syncFromStore();
    }
  }

  // ---- Scrubber: preview positions between two frames without changing the store ----
  onScrub(event: Event) {
    const t = +(event.target as HTMLInputElement).value;
    this.scrubPos.set(t);
    this.previewAt(t);
  }

  onScrubEnd() {
    this.store.goToFrame(Math.round(this.scrubPos()));
    this.syncFromStore(); // also snaps the pieces back when the frame didn't change
  }

  private previewAt(t: number) {
    const frames = this.store.frames();
    if (frames.length < 2 || !this.entityLayer) return;

    const i = Math.min(Math.floor(t), frames.length - 2);
    const progress = Konva.Easings.EaseInOut(t - i, 0, 1, 1);
    const next = new Map(frames[i + 1].entities.map(e => [e.id, e]));

    frames[i].entities.forEach(a => {
      const b = next.get(a.id);
      const node = this.entityLayer.findOne('#' + a.id);
      if (!b || !node) return;
      node.position({ x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress });
    });

    this.renderArrows(frames[t - i < 0.5 ? i : i + 1].arrows);
    this.ghostLayer.destroyChildren();
    this.ghostLayer.batchDraw();
    this.entityLayer.batchDraw();
    this.drawingLayer.batchDraw();
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
  private ghostLayer!: Konva.Layer;
  private divisionsLayer!: Konva.Layer;
  private entityLayer!: Konva.Layer;
  private resizeObserver!: ResizeObserver;

  // Drawing State
  private currentArrow: Konva.Group | null = null;
  private currentArrowStart: [number, number] = [0, 0];
  private currentArrowEnd: [number, number] = [0, 0];

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
    this.updateDraggable();
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
    this.ghostLayer = new Konva.Layer({ listening: false }); // previous-frame ghosts
    this.drawingLayer = new Konva.Layer(); // Sits below players, above pitch
    this.entityLayer = new Konva.Layer();

    this.stage.add(this.pitchLayer);
    this.stage.add(this.divisionsLayer);
    this.stage.add(this.ghostLayer);
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
      if (!this.isDrawingMode() || this.isPlaying() || this.isExporting()) return;

      // Ignore mousedown only if the user clicked on a curve control handle
      if (e.target.name() === 'curve-handle') return;

      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      // Divide by scale to map screen pixels to our internal 1050x680 grid
      const scale = this.stage.scaleX();
      const internalX = pos.x / scale;
      const internalY = pos.y / scale;

      this.currentArrowStart = [internalX, internalY];
      this.currentArrowEnd = [internalX, internalY];
      this.currentArrow = this.createArrow({
        points: [internalX, internalY, internalX, internalY],
        style: this.arrowStyle(),
      });

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

      this.currentArrowEnd = [internalX, internalY];
      const [x1, y1] = this.currentArrowStart;
      this.updateArrowGroup(
        this.currentArrow,
        [x1, y1, internalX, internalY],
        this.arrowStyle()
      );
    });

    // 3. Finish drawing on mouse up
    this.stage.on('mouseup touchend', () => {
      const arrow = this.currentArrow;
      if (!arrow) return;
      this.currentArrow = null;

      const [x1, y1] = this.currentArrowStart;
      const [x2, y2] = this.currentArrowEnd;
      arrow.destroy(); // the store-driven effect re-renders committed arrows
      if (Math.hypot(x2 - x1, y2 - y1) < 10) {
        this.drawingLayer.batchDraw();
        return; // ignore accidental taps
      }
      this.ngZone.run(() =>
        this.store.addArrow(
          [Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2)],
          this.arrowStyle()
        )
      );
    });
  }

  private drawPitch() {
    const turf = new Konva.Rect({ x: 0, y: 0, width: this.BASE_WIDTH, height: this.BASE_HEIGHT, fill: '#2e7d32', listening: false });
    const lineConfig = { stroke: 'rgba(255, 255, 255, 0.7)', strokeWidth: 3, listening: false };

    const boundary = new Konva.Rect({ x: 0, y: 0, width: this.BASE_WIDTH, height: this.BASE_HEIGHT, ...lineConfig });
    const halfwayLine = new Konva.Line({ points: [this.BASE_WIDTH / 2, 0, this.BASE_WIDTH / 2, this.BASE_HEIGHT], ...lineConfig });
    const centerCircle = new Konva.Circle({ x: this.BASE_WIDTH / 2, y: this.BASE_HEIGHT / 2, radius: 91.5, ...lineConfig });
    const leftBox = new Konva.Rect({ x: 0, y: (this.BASE_HEIGHT - 403.2) / 2, width: 165, height: 403.2, ...lineConfig });
    const rightBox = new Konva.Rect({ x: this.BASE_WIDTH - 165, y: (this.BASE_HEIGHT - 403.2) / 2, width: 165, height: 403.2, ...lineConfig });
    const leftGoalArea = new Konva.Rect({ x: 0, y: (this.BASE_HEIGHT - 183.2) / 2, width: 55, height: 183.2, ...lineConfig });
    const rightGoalArea = new Konva.Rect({ x: this.BASE_WIDTH - 55, y: (this.BASE_HEIGHT - 183.2) / 2, width: 55, height: 183.2, ...lineConfig });

    this.pitchLayer.add(turf, boundary, halfwayLine, centerCircle, leftBox, rightBox, leftGoalArea, rightGoalArea);
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
