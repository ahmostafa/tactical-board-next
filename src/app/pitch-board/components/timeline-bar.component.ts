import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-timeline-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-3 p-3 rounded-lg bg-[var(--tb-bg-surface)] text-[var(--tb-text-primary)] border border-[var(--tb-border)] shadow-sm flex flex-col gap-3 transition-colors">
      <div class="flex flex-wrap items-center gap-2">
        <button (click)="isPlaying() ? stop.emit() : play.emit()"
                [disabled]="isExporting() || (!isPlaying() && frameCount() < 2)"
                class="px-4 py-2 min-h-[40px] font-bold rounded-md shadow-sm disabled:opacity-40 transition-colors flex items-center gap-1.5"
                [class.bg-emerald-600]="!isPlaying()"
                [class.text-white]="!isPlaying()"
                [class.hover:bg-emerald-500]="!isPlaying()"
                [class.bg-rose-600]="isPlaying()"
                [class.text-white]="isPlaying()"
                [class.hover:bg-rose-500]="isPlaying()">
          <span>{{ isPlaying() ? '⏹' : '▶' }}</span>
          <span>{{ isPlaying() ? 'Stop' : 'Play' }}</span>
        </button>

        <button (click)="playStep.emit()"
                [disabled]="isPlaying() || isExporting() || frameCount() < 2"
                class="px-3 py-2 min-h-[40px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold disabled:opacity-40 transition-colors shadow-sm"
                title="Preview only the current step transition">
          Play Step
        </button>

        <fieldset class="flex flex-wrap items-center gap-1.5 border-0 p-0 m-0 min-w-0" [disabled]="isPlaying() || isExporting()">
          <button (click)="goToFrame.emit(currentFrame() - 1)" [disabled]="currentFrame() === 0"
                  class="min-w-[38px] min-h-[38px] px-2.5 py-1.5 bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md font-bold disabled:opacity-40 transition-colors"
                  aria-label="Previous frame">&lt;</button>
          @for (i of frameIndexes(); track i) {
            <button (click)="goToFrame.emit(i)"
                    class="min-w-[38px] min-h-[38px] px-2.5 py-1.5 rounded-md font-bold text-xs transition-colors border"
                    [class.bg-emerald-600]="i === currentFrame()"
                    [class.text-white]="i === currentFrame()"
                    [class.border-emerald-500]="i === currentFrame()"
                    [class.bg-[var(--tb-button-bg)]]="i !== currentFrame()"
                    [class.text-[var(--tb-button-text)]]="i !== currentFrame()"
                    [class.border-[var(--tb-border)]]="i !== currentFrame()"
                    [class.hover:bg-[var(--tb-button-hover)]]="i !== currentFrame()">{{ i + 1 }}</button>
          }
          <button (click)="goToFrame.emit(currentFrame() + 1)"
                  [disabled]="currentFrame() >= frameCount() - 1"
                  class="min-w-[38px] min-h-[38px] px-2.5 py-1.5 bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md font-bold disabled:opacity-40 transition-colors"
                  aria-label="Next frame">&gt;</button>

          <button (click)="addFrame.emit()" class="px-3 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold shadow-sm transition-colors"
                  title="New step with the same positions and no arrows">+ Frame</button>
          <button (click)="duplicateFrame.emit()" class="px-3 py-2 min-h-[38px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md text-xs font-bold transition-colors"
                  title="Copy this step including its arrows">Duplicate</button>
          <button (click)="deleteFrame.emit()" [disabled]="frameCount() < 2"
                  class="px-3 py-2 min-h-[38px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md text-xs font-bold disabled:opacity-40 transition-colors">Delete</button>

          <span class="text-[var(--tb-border)] mx-1">|</span>

          <button (click)="exportPng.emit()"
                  class="px-3 py-2 min-h-[38px] bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-bold shadow-sm transition-colors"
                  title="Download high-resolution PNG image of the current board">
            Export PNG
          </button>
          <button (click)="exportGif.emit()" [disabled]="frameCount() < 2"
                  class="px-3 py-2 min-h-[38px] bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-bold disabled:opacity-40 shadow-sm transition-colors"
                  title="Render the timeline into a looping animated GIF">
            {{ isExporting() && exportKind() === 'gif' ? 'GIF (' + exportProgress() + '%)' : 'Export GIF' }}
          </button>
          <button (click)="exportMp4.emit()" [disabled]="frameCount() < 2"
                  class="px-3 py-2 min-h-[38px] bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-bold disabled:opacity-40 shadow-sm transition-colors"
                  title="Render the timeline into a downloadable 720p MP4 video">
            {{ isExporting() && exportKind() === 'mp4' ? 'Exporting (' + exportProgress() + '%)' : 'Export MP4' }}
          </button>
        </fieldset>
      </div>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <label class="flex items-center gap-2 grow min-w-44 font-medium">
          Scrub
          <input type="range" class="w-full accent-emerald-600 cursor-pointer" min="0" step="0.01"
                 [max]="frameCount() - 1" [value]="scrubPos()"
                 [disabled]="isPlaying() || isExporting() || frameCount() < 2"
                 (input)="scrubInput.emit($event)" (change)="scrubEnd.emit()" />
        </label>
        <label class="flex items-center gap-1.5 font-medium">
          Step {{ (stepDurationMs() / 1000).toFixed(1) }}s
          <input type="range" min="300" max="3000" step="100" [value]="stepDurationMs()"
                 class="accent-emerald-600 cursor-pointer"
                 (input)="stepDurationChange.emit(+$any($event.target).value)" />
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer font-medium select-none">
          <input type="checkbox" [checked]="loopPlayback()" (change)="loopPlaybackChange.emit(!loopPlayback())" class="rounded border-gray-400" />
          Loop
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer font-medium select-none">
          <input type="checkbox" [checked]="showGhost()" (change)="showGhostChange.emit(!showGhost())" class="rounded border-gray-400" />
          Ghost previous frame
        </label>
        <input type="text"
               placeholder="Frame coaching note (e.g. Phase 1: High Press)..."
               class="bg-[var(--tb-bg-surface-elevated)] text-[var(--tb-text-primary)] px-3 py-1.5 rounded-md border border-[var(--tb-border)] w-full sm:w-64 min-h-[36px]"
               [value]="note()"
               (input)="noteChange.emit($any($event.target).value)" />
      </div>
    </div>
  `,
})
export class TimelineBarComponent {
  isPlaying = input.required<boolean>();
  isExporting = input.required<boolean>();
  exportKind = input.required<'mp4' | 'gif'>();
  exportProgress = input.required<number>();
  frameCount = input.required<number>();
  currentFrame = input.required<number>();
  scrubPos = input.required<number>();
  stepDurationMs = input.required<number>();
  loopPlayback = input.required<boolean>();
  showGhost = input.required<boolean>();
  note = input.required<string>();

  protected frameIndexes = computed(() =>
    Array.from({ length: this.frameCount() }, (_, i) => i)
  );

  play = output<void>();
  stop = output<void>();
  playStep = output<void>();
  goToFrame = output<number>();
  addFrame = output<void>();
  duplicateFrame = output<void>();
  deleteFrame = output<void>();
  exportPng = output<void>();
  exportGif = output<void>();
  exportMp4 = output<void>();
  scrubInput = output<Event>();
  scrubEnd = output<void>();
  stepDurationChange = output<number>();
  loopPlaybackChange = output<boolean>();
  showGhostChange = output<boolean>();
  noteChange = output<string>();
}
