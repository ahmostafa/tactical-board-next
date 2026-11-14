import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-timeline-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-3 p-3 rounded-md bg-gray-800 text-white flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <button (click)="isPlaying() ? stop.emit() : play.emit()"
                [disabled]="isExporting() || (!isPlaying() && frameCount() < 2)"
                class="px-4 py-1.5 font-bold rounded shadow-md disabled:opacity-40"
                [class.bg-blue-600]="!isPlaying()"
                [class.bg-red-600]="isPlaying()">
          {{ isPlaying() ? 'Stop' : 'Play' }}
        </button>

        <button (click)="playStep.emit()"
                [disabled]="isPlaying() || isExporting() || frameCount() < 2"
                class="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 rounded text-xs font-bold disabled:opacity-40"
                title="Preview only the current step transition">
          Play Step
        </button>

        <fieldset class="flex flex-wrap items-center gap-1.5 border-0 p-0 m-0 min-w-0" [disabled]="isPlaying() || isExporting()">
          <button (click)="goToFrame.emit(currentFrame() - 1)" [disabled]="currentFrame() === 0"
                  class="px-2.5 py-1.5 bg-gray-700 rounded disabled:opacity-40" aria-label="Previous frame">&lt;</button>
          @for (i of frameIndexes(); track i) {
            <button (click)="goToFrame.emit(i)"
                    class="min-w-8 px-2.5 py-1.5 rounded font-bold text-xs"
                    [class.bg-emerald-600]="i === currentFrame()"
                    [class.bg-gray-700]="i !== currentFrame()">{{ i + 1 }}</button>
          }
          <button (click)="goToFrame.emit(currentFrame() + 1)"
                  [disabled]="currentFrame() >= frameCount() - 1"
                  class="px-2.5 py-1.5 bg-gray-700 rounded disabled:opacity-40" aria-label="Next frame">&gt;</button>

          <button (click)="addFrame.emit()" class="px-3 py-1.5 bg-blue-700 rounded text-xs font-bold"
                  title="New step with the same positions and no arrows">+ Frame</button>
          <button (click)="duplicateFrame.emit()" class="px-3 py-1.5 bg-gray-700 rounded text-xs font-bold"
                  title="Copy this step including its arrows">Duplicate</button>
          <button (click)="deleteFrame.emit()" [disabled]="frameCount() < 2"
                  class="px-3 py-1.5 bg-gray-700 rounded text-xs font-bold disabled:opacity-40">Delete</button>

          <span class="text-gray-600 mx-1">|</span>

          <button (click)="exportPng.emit()"
                  class="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 rounded text-xs font-bold"
                  title="Download high-resolution PNG image of the current board">
            Export PNG
          </button>
          <button (click)="exportGif.emit()" [disabled]="frameCount() < 2"
                  class="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-xs font-bold disabled:opacity-40"
                  title="Render the timeline into a looping animated GIF">
            {{ isExporting() && exportKind() === 'gif' ? 'GIF (' + exportProgress() + '%)' : 'Export GIF' }}
          </button>
          <button (click)="exportMp4.emit()" [disabled]="frameCount() < 2"
                  class="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-xs font-bold disabled:opacity-40"
                  title="Render the timeline into a downloadable 720p MP4 video">
            {{ isExporting() && exportKind() === 'mp4' ? 'Exporting (' + exportProgress() + '%)' : 'Export MP4' }}
          </button>
        </fieldset>
      </div>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <label class="flex items-center gap-2 grow min-w-44">
          Scrub
          <input type="range" class="w-full" min="0" step="0.01"
                 [max]="frameCount() - 1" [value]="scrubPos()"
                 [disabled]="isPlaying() || isExporting() || frameCount() < 2"
                 (input)="scrubInput.emit($event)" (change)="scrubEnd.emit()" />
        </label>
        <label class="flex items-center gap-1.5">
          Step {{ (stepDurationMs() / 1000).toFixed(1) }}s
          <input type="range" min="300" max="3000" step="100" [value]="stepDurationMs()"
                 (input)="stepDurationChange.emit(+$any($event.target).value)" />
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" [checked]="loopPlayback()" (change)="loopPlaybackChange.emit(!loopPlayback())" />
          Loop
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" [checked]="showGhost()" (change)="showGhostChange.emit(!showGhost())" />
          Ghost previous frame
        </label>
        <input type="text"
               placeholder="Frame coaching note (e.g. Phase 1: High Press)..."
               class="bg-gray-900 text-white px-2.5 py-1 rounded border border-gray-700 w-64"
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
