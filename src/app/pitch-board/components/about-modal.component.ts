import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import {
  APP_AUTHOR,
  APP_LICENSE,
  APP_NAME,
  APP_RELEASE_DATE,
  APP_RELEASES_URL,
  APP_REPO_URL,
  APP_VERSION,
} from '../../../environments/version';

@Component({
  selector: 'app-about-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
      data-testid="about-modal"
      (click)="closeModal.emit()"
    >
      <div
        class="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-emerald-500/40 shadow-2xl text-gray-900 dark:text-gray-100 overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 bg-gray-100 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-xl" aria-hidden="true">⚽</span>
            <h2 id="about-modal-title" class="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
              {{ appName }}
            </h2>
            <span
              data-testid="about-version-badge"
              class="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 dark:border-emerald-500/40"
            >
              {{ version }} (Production)
            </span>
          </div>
          <button
            type="button"
            data-testid="close-about-btn"
            aria-label="Close About dialog"
            (click)="closeModal.emit()"
            class="px-2.5 py-1 text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
          >
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4 text-xs sm:text-sm">
          <!-- Metadata Grid -->
          <div class="grid grid-cols-2 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">Version</div>
              <div class="font-mono font-bold text-emerald-600 dark:text-emerald-300">{{ version }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">Release Date</div>
              <div class="font-semibold text-gray-900 dark:text-white">{{ releaseDate }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">License</div>
              <div class="font-semibold text-gray-900 dark:text-white">{{ license }} Open Source</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">Author</div>
              <div class="font-semibold text-gray-900 dark:text-white">{{ author }}</div>
            </div>
          </div>

          <!-- Core Capabilities -->
          <div>
            <h3 class="font-bold text-amber-600 dark:text-amber-300 uppercase text-[11px] tracking-wider mb-1.5">
              Core Tactical Capabilities
            </h3>
            <ul class="space-y-1 text-gray-700 dark:text-gray-300 text-xs list-disc list-inside">
              <li>6 Tactical Arrow Styles (Pass, Run, Dribble, Target Zone, Block ┬, Freehand with Bézier curves)</li>
              <li>Full FIFA 105m × 68m Pitch Divisions &amp; 20-zone <em>Juego de Posición</em> engine</li>
              <li>5 Squad Modes (11v11, 9v9, 7v7, 5v5 &amp; Empty Pitch Free Build drill designer)</li>
              <li>60fps Keyframe Timeline playback &amp; client-side HD H.264 MP4 / GIF export</li>
            </ul>
          </div>

          <!-- Security & Privacy Statement -->
          <div class="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-600/40 text-emerald-800 dark:text-emerald-200 text-xs">
            <span class="font-bold text-emerald-900 dark:text-emerald-300">Privacy &amp; Security Guarantee:</span>
            100% Free, Ad-Free, Strictly Non-Google, and Privacy-First (Zero Cookies). All tactical boards and video exports run locally in your browser.
          </div>

          <!-- Links & Footer Actions -->
          <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
            <div class="flex items-center gap-3 text-xs">
              <a
                [href]="repoUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sky-600 dark:text-sky-400 hover:underline font-semibold"
              >
                GitHub Repository
              </a>
              <a
                [href]="releasesUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sky-600 dark:text-sky-400 hover:underline font-semibold"
              >
                Release Notes
              </a>
            </div>
            <button
              type="button"
              (click)="closeModal.emit()"
              class="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AboutModalComponent {
  @Output() closeModal = new EventEmitter<void>();

  protected readonly version = APP_VERSION;
  protected readonly releaseDate = APP_RELEASE_DATE;
  protected readonly appName = APP_NAME;
  protected readonly author = APP_AUTHOR;
  protected readonly license = APP_LICENSE;
  protected readonly repoUrl = APP_REPO_URL;
  protected readonly releasesUrl = APP_RELEASES_URL;
}
