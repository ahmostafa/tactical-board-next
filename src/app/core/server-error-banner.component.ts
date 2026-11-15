import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-server-error-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="server-error-view"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="server-error-title"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div class="w-full max-w-lg rounded-xl bg-gray-900 border border-rose-500/60 shadow-2xl text-gray-100 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3.5 bg-rose-950/70 border-b border-rose-500/40">
          <div class="flex items-center gap-2.5">
            <span class="text-xl" aria-hidden="true">⚠️</span>
            <h2 id="server-error-title" class="text-base font-extrabold text-rose-200">
              {{ code }} — Server / Tactical Engine Error
            </h2>
          </div>
          <span class="font-mono text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Recovery Mode
          </span>
        </div>

        <div class="p-5 space-y-4 text-xs sm:text-sm">
          <p class="text-gray-300 leading-relaxed">
            A server resource failure or unexpected tactical engine runtime error occurred. Your session can be safely recovered using the options below.
          </p>

          @if (message) {
            <div class="p-3 rounded-lg bg-gray-950 border border-gray-800 font-mono text-xs text-rose-300 break-words">
              {{ message }}
            </div>
          }

          <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-800">
            <button
              type="button"
              data-testid="dismiss-error-btn"
              (click)="dismiss.emit()"
              class="px-3.5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold text-xs transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              data-testid="reset-storage-btn"
              (click)="resetStorage.emit()"
              class="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors"
            >
              💾 Reset to Clean Default
            </button>
            <button
              type="button"
              (click)="reloadPage.emit()"
              class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              🔄 Reload Board
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ServerErrorBannerComponent {
  @Input() code: '500' | 'RUNTIME' = '500';
  @Input() message = '';
  @Output() dismiss = new EventEmitter<void>();
  @Output() resetStorage = new EventEmitter<void>();
  @Output() reloadPage = new EventEmitter<void>();
}
