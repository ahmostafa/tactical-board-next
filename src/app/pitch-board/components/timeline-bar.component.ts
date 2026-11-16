import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-timeline-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-3 p-3 rounded-lg bg-[var(--tb-bg-surface)] text-[var(--tb-text-primary)] border border-[var(--tb-border)] shadow-sm flex flex-col gap-3 transition-colors">
      <!-- Main Playback & Frame Controller Strip -->
      <div class="flex flex-wrap items-center justify-between gap-2.5">
        <!-- Play / Stop & Step Group -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button (click)="isPlaying() ? stop.emit() : play.emit()"
                  [disabled]="isExporting() || (!isPlaying() && frameCount() < 2)"
                  class="px-4 py-2 min-h-[40px] font-bold rounded-md shadow-sm disabled:opacity-40 transition-all flex items-center gap-2"
                  [class.bg-emerald-600]="!isPlaying()"
                  [class.text-white]="!isPlaying()"
                  [class.hover:bg-emerald-500]="!isPlaying()"
                  [class.bg-rose-600]="isPlaying()"
                  [class.text-white]="isPlaying()"
                  [class.hover:bg-rose-500]="isPlaying()">
            @if (isPlaying()) {
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              <span>Stop</span>
            } @else {
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Play</span>
            }
          </button>

          <button (click)="playStep.emit()"
                  [disabled]="isPlaying() || isExporting() || frameCount() < 2"
                  class="px-3 py-2 min-h-[40px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold disabled:opacity-40 transition-colors shadow-sm flex items-center gap-1.5"
                  title="Preview only the current step transition">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
            <span class="hidden sm:inline">Play Step</span>
          </button>
        </div>

        <!-- Frame Navigation & Editing Group -->
        <fieldset class="flex flex-wrap items-center gap-1 border-0 p-0 m-0 min-w-0" [disabled]="isPlaying() || isExporting()">
          <button (click)="goToFrame.emit(currentFrame() - 1)" [disabled]="currentFrame() === 0"
                  class="min-w-[38px] min-h-[38px] px-2 py-1.5 bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md font-bold disabled:opacity-40 transition-colors flex items-center justify-center"
                  aria-label="Previous frame">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          @for (i of frameIndexes(); track i) {
            <button (click)="goToFrame.emit(i)"
                    class="min-w-[36px] min-h-[38px] px-2 py-1.5 rounded-md font-bold text-xs transition-colors border"
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
                  class="min-w-[38px] min-h-[38px] px-2 py-1.5 bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md font-bold disabled:opacity-40 transition-colors flex items-center justify-center"
                  aria-label="Next frame">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <button (click)="addFrame.emit()" class="px-2.5 sm:px-3 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold shadow-sm transition-colors flex items-center gap-1"
                  title="New step with the same positions and no arrows">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Frame</span>
          </button>
          <button (click)="duplicateFrame.emit()" class="px-2.5 sm:px-3 py-2 min-h-[38px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                  title="Copy this step including its arrows">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span class="hidden sm:inline">Duplicate</span>
          </button>
          <button (click)="deleteFrame.emit()" [disabled]="frameCount() < 2"
                  class="px-2.5 sm:px-3 py-2 min-h-[38px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            <span class="hidden sm:inline">Delete</span>
          </button>
        </fieldset>

        <!-- Media Export Group -->
        <fieldset class="flex items-center gap-1.5 border-0 p-0 m-0 min-w-0 ml-auto" [disabled]="isPlaying() || isExporting()">
          <button (click)="exportPng.emit()"
                  class="px-2.5 sm:px-3 py-2 min-h-[38px] bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                  title="Download high-resolution PNG image of the current board">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            <span>PNG</span>
          </button>
          <button (click)="exportGif.emit()" [disabled]="frameCount() < 2"
                  class="px-2.5 sm:px-3 py-2 min-h-[38px] bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-bold disabled:opacity-40 shadow-sm transition-colors flex items-center gap-1.5"
                  title="Render the timeline into a looping animated GIF">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="15" x="2" y="5" rx="2"/><polyline points="8 10 12 14 16 10"/></svg>
            <span>{{ isExporting() && exportKind() === 'gif' ? 'GIF (' + exportProgress() + '%)' : 'GIF' }}</span>
          </button>
          <button (click)="exportMp4.emit()" [disabled]="frameCount() < 2"
                  class="px-2.5 sm:px-3 py-2 min-h-[38px] bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-bold disabled:opacity-40 shadow-sm transition-colors flex items-center gap-1.5"
                  title="Render the timeline into a downloadable 720p MP4 video">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
            <span>{{ isExporting() && exportKind() === 'mp4' ? 'MP4 (' + exportProgress() + '%)' : 'MP4' }}</span>
          </button>
        </fieldset>
      </div>

      <!-- Scrubbing, Speed, Loop & Note Controls -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2.5 text-xs pt-1 border-t border-[var(--tb-border-subtle)]">
        <label class="flex items-center gap-2 grow min-w-44 font-semibold text-slate-800 dark:text-slate-200">
          <span>Scrub</span>
          <input type="range" class="w-full accent-emerald-600 cursor-pointer" min="0" step="0.01"
                 [max]="frameCount() - 1" [value]="scrubPos()"
                 [disabled]="isPlaying() || isExporting() || frameCount() < 2"
                 (input)="scrubInput.emit($event)" (change)="scrubEnd.emit()" />
        </label>
        <label class="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
          <span>{{ (stepDurationMs() / 1000).toFixed(1) }}s</span>
          <input type="range" min="300" max="3000" step="100" [value]="stepDurationMs()"
                 class="w-20 accent-emerald-600 cursor-pointer"
                 (input)="stepDurationChange.emit(+$any($event.target).value)" />
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer font-semibold select-none text-slate-800 dark:text-slate-200">
          <input type="checkbox" [checked]="loopPlayback()" (change)="loopPlaybackChange.emit(!loopPlayback())" class="rounded border-gray-400" />
          <span>Loop</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer font-semibold select-none text-slate-800 dark:text-slate-200">
          <input type="checkbox" [checked]="showGhost()" (change)="showGhostChange.emit(!showGhost())" class="rounded border-gray-400" />
          <span>Ghost Trails</span>
        </label>
        <input type="text"
               placeholder="Frame coaching note (e.g. Phase 1: High Press)..."
               class="bg-[var(--tb-bg-surface-elevated)] text-[var(--tb-text-primary)] px-3 py-1.5 rounded-md border border-[var(--tb-border)] w-full sm:w-64 min-h-[36px] ml-auto"
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
