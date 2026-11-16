import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DemoTacticPreset, TourStep } from '../models/tactical-board.models';

@Component({
  selector: 'app-tour-demos-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Interactive Onboarding Tour Banner -->
    @if (showTour()) {
      @if (currentTourStep(); as ts) {
        <div class="mb-2 p-3.5 rounded-lg bg-gradient-to-r from-indigo-950 via-slate-900 to-gray-900 border border-amber-400/80 shadow-xl text-xs flex flex-col gap-2.5 text-white">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-amber-400 text-gray-950 font-extrabold text-[11px]">
                Step {{ ts.step }} / {{ tourSteps().length }}
              </span>
              <span class="px-2 py-0.5 rounded bg-indigo-700 text-indigo-100 font-semibold text-[11px]">{{ ts.badge }}</span>
              <span class="font-bold text-sm text-white">{{ ts.title }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              @for (s of tourSteps(); track s.step; let idx = $index) {
                <button type="button" (click)="selectStep.emit(idx)"
                        class="w-3 h-3 rounded-full transition-all"
                        [class.bg-amber-400]="idx === tourIndex()"
                        [class.scale-125]="idx === tourIndex()"
                        [class.bg-gray-600]="idx !== tourIndex()"
                        [attr.aria-label]="'Tour step ' + s.step"></button>
              }
            </div>
          </div>
          <p class="text-gray-200 leading-relaxed text-xs">{{ ts.description }}</p>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" (click)="prevStep.emit()" [disabled]="tourIndex() === 0"
                    class="px-3 py-1.5 min-h-[36px] bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-md font-semibold disabled:opacity-40 transition-colors">
              ← Previous
            </button>
            <button type="button" (click)="nextStep.emit()" [disabled]="tourIndex() >= tourSteps().length - 1"
                    class="px-3 py-1.5 min-h-[36px] bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-md font-semibold disabled:opacity-40 transition-colors">
              Next →
            </button>
            <button type="button" (click)="tryAction.emit(ts.step)"
                    class="px-3.5 py-1.5 min-h-[36px] bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold rounded-md shadow transition-colors">
              ⚡ {{ ts.tryLabel }}
            </button>
            <button type="button" (click)="closeTour.emit()"
                    class="ml-auto px-3 py-1.5 min-h-[36px] bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-md transition-colors">
              Close Guide
            </button>
          </div>
        </div>
      }
    }

    <!-- Collapsible Demo Tactics Starter Pack Drawer -->
    @if (showDemos()) {
      <div class="mb-2 p-3.5 rounded-lg bg-[var(--tb-bg-surface)] text-[var(--tb-text-primary)] border border-purple-500/50 shadow-md text-xs flex flex-col gap-2.5 transition-colors">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-extrabold text-purple-600 dark:text-purple-400 text-sm">Interactive Demo Tactics & Drills</span>
            <span class="ml-2 text-[var(--tb-text-secondary)] hidden sm:inline">Click any preset to load its multi-frame animation onto the pitch, then press Play!</span>
          </div>
          <button type="button" (click)="closeDemos.emit()"
                  class="px-3 py-1.5 min-h-[36px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md font-medium transition-colors">Close</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          @for (demo of demoTactics(); track demo.id) {
            <div class="p-3 rounded-lg bg-[var(--tb-bg-surface-elevated)] border border-[var(--tb-border)] flex flex-col justify-between gap-2 shadow-sm">
              <div>
                <div class="flex items-center justify-between gap-1.5 mb-1">
                  <span class="font-bold text-[var(--tb-text-primary)]">{{ demo.title }}</span>
                  <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-[10px] font-semibold shrink-0">{{ demo.badge }}</span>
                </div>
                <p class="text-[var(--tb-text-secondary)] text-[11px] leading-snug">{{ demo.subtitle }}</p>
              </div>
              <div class="flex items-center gap-2 pt-1">
                <button type="button" (click)="loadDemo.emit({ demo, autoPlay: false })"
                        class="px-3 py-1.5 min-h-[34px] bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-md shadow-sm transition-colors">
                  Load ({{ demo.frames.length }} steps)
                </button>
                <button type="button" (click)="loadDemo.emit({ demo, autoPlay: true })"
                        class="px-3 py-1.5 min-h-[34px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-md shadow-sm transition-colors">
                  ▶ Load & Play
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class TourDemosPanelComponent {
  showTour = input.required<boolean>();
  tourIndex = input.required<number>();
  tourSteps = input.required<TourStep[]>();
  showDemos = input.required<boolean>();
  demoTactics = input.required<DemoTacticPreset[]>();

  currentTourStep = computed(() => this.tourSteps()[this.tourIndex()] ?? null);

  selectStep = output<number>();
  prevStep = output<void>();
  nextStep = output<void>();
  tryAction = output<number>();
  closeTour = output<void>();
  closeDemos = output<void>();
  loadDemo = output<{ demo: DemoTacticPreset; autoPlay: boolean }>();
}
