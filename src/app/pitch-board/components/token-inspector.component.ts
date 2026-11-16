import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TacticalEntity } from '../models/tactical-board.models';
import { getTacticalLocationSummary } from '../canvas/pitch-divisions';

@Component({
  selector: 'app-token-inspector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entity(); as sel) {
      <div class="flex flex-wrap items-center gap-3 mb-2 p-2.5 rounded-lg bg-[var(--tb-bg-surface-elevated)] text-[var(--tb-text-primary)] border border-indigo-500/50 shadow-sm text-xs transition-colors">
        <span class="font-bold text-indigo-600 dark:text-indigo-300">
          Selected: {{ sel.type === 'home' ? 'Home Player' : sel.type === 'away' ? 'Away Player' : sel.type === 'referee' ? 'Referee' : sel.equipmentKind || 'Ball' }}
        </span>

        @if (location(); as loc) {
          <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--tb-bg-surface)] border border-[var(--tb-border)] text-[11px] text-[var(--tb-text-secondary)] shadow-sm"
                title="Normalized FIFA 105m × 68m coordinates, 18-Zone Grid, and 20-Zone Juego de Posición code">
            <span class="text-amber-600 dark:text-amber-400 font-semibold">Zone {{ loc.zone18 }}</span>
            <span class="text-gray-400">·</span>
            <span class="text-sky-600 dark:text-sky-400 font-semibold">{{ loc.zone20 }}</span>
            <span class="text-gray-400">·</span>
            <span class="font-medium">{{ loc.xMeters }}m × {{ loc.yMeters }}m</span>
            <span class="hidden md:inline text-gray-500">({{ loc.third }} / {{ loc.channel }})</span>
            @for (sub of loc.subZones; track sub) {
              <span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                {{ sub }}
              </span>
            }
          </span>
        }

        @if (sel.type === 'home' || sel.type === 'away' || sel.type === 'referee') {
          <label class="flex items-center gap-1.5 font-medium">
            Number:
            <input type="text" maxlength="3"
                   class="w-12 bg-[var(--tb-bg-surface)] text-[var(--tb-text-primary)] px-1.5 py-1 rounded-md border border-[var(--tb-border)] text-center font-bold"
                   [value]="sel.label ?? ''"
                   (input)="updateMeta.emit({ label: $any($event.target).value })" />
          </label>
          <label class="flex items-center gap-1.5 font-medium">
            Name / Role:
            <input type="text" maxlength="18" placeholder="e.g. Salah / CDM"
                   class="w-32 bg-[var(--tb-bg-surface)] text-[var(--tb-text-primary)] px-2 py-1 rounded-md border border-[var(--tb-border)]"
                   [value]="sel.name ?? ''"
                   (input)="updateMeta.emit({ name: $any($event.target).value })" />
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer font-medium select-none">
            <input type="checkbox"
                   [checked]="!!sel.showVision"
                   (change)="updateMeta.emit({ showVision: !sel.showVision, facing: sel.facing ?? (sel.type === 'away' ? 180 : 0) })"
                   class="rounded border-gray-400" />
            Vision Cone
          </label>
          @if (sel.showVision) {
            <label class="flex items-center gap-1.5 font-medium">
              Facing {{ sel.facing ?? 0 }}°
              <input type="range" min="0" max="355" step="5" class="w-24 accent-indigo-600"
                     [value]="sel.facing ?? 0"
                     (input)="updateMeta.emit({ facing: +$any($event.target).value })" />
            </label>
          }
        }

        @if (sel.type === 'equipment') {
          <button type="button"
                  (click)="updateMeta.emit({ rotation: ((sel.rotation ?? 0) + 45) % 360 })"
                  class="px-2.5 py-1 min-h-[32px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md font-semibold transition-colors">
            Rotate 45° ({{ sel.rotation ?? 0 }}°)
          </button>
          <input type="color" aria-label="Equipment color"
                 class="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0 p-0"
                 [value]="sel.color || '#f97316'"
                 (input)="updateMeta.emit({ color: $any($event.target).value })" />
        }

        @if (sel.id !== 'ball') {
          <button type="button" (click)="removeEntity.emit()"
                  class="px-2.5 py-1 min-h-[32px] bg-rose-700 hover:bg-rose-600 text-white rounded-md font-semibold transition-colors shadow-sm">
            Remove from Pitch
          </button>
        }
        <button type="button" (click)="closeInspector.emit()"
                class="ml-auto px-3 py-1 min-h-[32px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md font-semibold transition-colors">Done</button>
      </div>
    }
  `,
})
export class TokenInspectorComponent {
  entity = input.required<TacticalEntity | null>();
  updateMeta = output<Partial<TacticalEntity>>();
  removeEntity = output<void>();
  closeInspector = output<void>();

  protected location = computed(() => {
    const e = this.entity();
    return e ? getTacticalLocationSummary(e.x, e.y) : null;
  });
}
