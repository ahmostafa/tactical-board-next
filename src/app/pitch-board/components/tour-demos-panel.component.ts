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
        <div class="mb-2 p-3 rounded-md bg-gradient-to-r from-indigo-950 via-gray-900 to-slate-900 border border-amber-400/70 shadow-xl text-xs flex flex-col gap-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-amber-400 text-gray-950 font-extrabold">
                Step {{ ts.step }} / {{ tourSteps().length }}
              </span>
              <span class="px-2 py-0.5 rounded bg-indigo-800 text-indigo-200 font-semibold">{{ ts.badge }}</span>
              <span class="font-bold text-sm text-white">{{ ts.title }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              @for (s of tourSteps(); track s.step; let idx = $index) {
                <button type="button" (click)="selectStep.emit(idx)"
                        class="w-2.5 h-2.5 rounded-full transition-all"
                        [class.bg-amber-400]="idx === tourIndex()"
                        [class.scale-125]="idx === tourIndex()"
                        [class.bg-gray-600]="idx !== tourIndex()"
                        [attr.aria-label]="'Tour step ' + s.step"></button>
              }
            </div>
          </div>
          <p class="text-gray-200 leading-relaxed">{{ ts.description }}</p>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" (click)="prevStep.emit()" [disabled]="tourIndex() === 0"
                    class="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded font-semibold disabled:opacity-40">
              ← Previous
            </button>
            <button type="button" (click)="nextStep.emit()" [disabled]="tourIndex() >= tourSteps().length - 1"
                    class="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded font-semibold disabled:opacity-40">
              Next →
            </button>
            <button type="button" (click)="tryAction.emit(ts.step)"
                    class="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold rounded shadow">
              ⚡ {{ ts.tryLabel }}
            </button>
            <button type="button" (click)="closeTour.emit()"
                    class="ml-auto px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded">
              Close Guide
            </button>
          </div>
        </div>
      }
    }

    <!-- Collapsible Demo Tactics Starter Pack Drawer -->
    @if (showDemos()) {
      <div class="mb-2 p-3 rounded bg-gray-800 border border-purple-500/60 text-xs flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-bold text-purple-300 text-sm">Interactive Demo Tactics & Drills</span>
            <span class="ml-2 text-gray-400">Click any preset to load its multi-frame animation onto the pitch, then press Play!</span>
          </div>
          <button type="button" (click)="closeDemos.emit()" class="px-2 py-1 bg-gray-700 rounded">Close</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          @for (demo of demoTactics(); track demo.id) {
            <div class="p-2.5 rounded bg-gray-900/90 border border-gray-700 flex flex-col justify-between gap-2">
              <div>
                <div class="flex items-center justify-between gap-1 mb-1">
                  <span class="font-bold text-white">{{ demo.title }}</span>
                  <span class="px-1.5 py-0.5 rounded bg-purple-900/80 text-purple-200 text-[10px] font-semibold shrink-0">{{ demo.badge }}</span>
                </div>
                <p class="text-gray-400 text-[11px] leading-snug">{{ demo.subtitle }}</p>
              </div>
              <div class="flex items-center gap-2 pt-1">
                <button type="button" (click)="loadDemo.emit({ demo, autoPlay: false })"
                        class="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded">
                  Load ({{ demo.frames.length }} steps)
                </button>
                <button type="button" (click)="loadDemo.emit({ demo, autoPlay: true })"
                        class="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded">
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
