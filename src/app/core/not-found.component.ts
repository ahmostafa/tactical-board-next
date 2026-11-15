import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { APP_NAME, APP_VERSION } from '../../environments/version';

@Component({
  selector: 'app-not-found',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="not-found-view"
      class="min-h-[85vh] w-full flex items-center justify-center p-6 text-gray-100"
    >
      <div class="w-full max-w-md rounded-2xl bg-gray-800/95 border border-amber-500/40 shadow-2xl p-6 text-center space-y-4">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/40 text-3xl" aria-hidden="true">
          🚩
        </div>

        <div class="space-y-1">
          <div class="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
            HTTP 404 • Out of Bounds
          </div>
          <h1 class="text-xl sm:text-2xl font-extrabold text-white">
            404 — Page Not Available / Out of Bounds
          </h1>
        </div>

        <p class="text-xs sm:text-sm text-gray-300 leading-relaxed">
          The tactical board route or shared link you requested could not be found on the pitch.
        </p>

        @if (requestedPath) {
          <div class="px-3 py-2 rounded bg-gray-900 border border-gray-700 font-mono text-xs text-rose-300 break-all">
            Requested path: {{ requestedPath }}
          </div>
        }

        <div class="pt-2 flex flex-col items-center gap-3">
          <button
            type="button"
            data-testid="return-to-pitch-btn"
            (click)="returnToPitch.emit()"
            class="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition-colors"
          >
            ⚽ Return to Tactical Board
          </button>
          <div class="text-[11px] text-gray-400 font-mono">
            {{ appName }} • {{ version }}
          </div>
        </div>
      </div>
    </div>
  `,
})
export class NotFoundComponent {
  @Input() requestedPath = '';
  @Output() returnToPitch = new EventEmitter<void>();

  protected readonly appName = APP_NAME;
  protected readonly version = APP_VERSION;
}
