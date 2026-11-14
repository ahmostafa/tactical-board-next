import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TacticalEntity } from '../models/tactical-board.models';
import { getTacticalLocationSummary } from '../canvas/pitch-divisions';

@Component({
  selector: 'app-token-inspector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entity(); as sel) {
      <div class="flex flex-wrap items-center gap-3 mb-2 px-3 py-2 rounded bg-indigo-950/90 border border-indigo-500/60 text-xs">
        <span class="font-bold text-indigo-300">
          Selected: {{ sel.type === 'home' ? 'Home Player' : sel.type === 'away' ? 'Away Player' : sel.type === 'referee' ? 'Referee' : sel.equipmentKind || 'Ball' }}
        </span>

        @if (location(); as loc) {
          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/90 border border-indigo-400/40 text-[11px] text-slate-200"
                title="Normalized FIFA 105m × 68m coordinates, 18-Zone Grid, and 20-Zone Juego de Posición code">
            <span class="text-amber-300 font-semibold">Zone {{ loc.zone18 }}</span>
            <span class="text-slate-500">·</span>
            <span class="text-sky-300 font-semibold">{{ loc.zone20 }}</span>
            <span class="text-slate-500">·</span>
            <span class="text-slate-300">{{ loc.xMeters }}m × {{ loc.yMeters }}m</span>
            <span class="hidden md:inline text-slate-400">({{ loc.third }} / {{ loc.channel }})</span>
            @for (sub of loc.subZones; track sub) {
              <span class="px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/50 text-amber-200 font-bold text-[10px]">
                {{ sub }}
              </span>
            }
          </span>
        }

        @if (sel.type === 'home' || sel.type === 'away' || sel.type === 'referee') {
          <label class="flex items-center gap-1">
            Number:
            <input type="text" maxlength="3"
                   class="w-12 bg-gray-900 text-white px-1.5 py-0.5 rounded border border-gray-600 text-center font-bold"
                   [value]="sel.label ?? ''"
                   (input)="updateMeta.emit({ label: $any($event.target).value })" />
          </label>
          <label class="flex items-center gap-1">
            Name / Role:
            <input type="text" maxlength="18" placeholder="e.g. Salah / CDM"
                   class="w-32 bg-gray-900 text-white px-2 py-0.5 rounded border border-gray-600"
                   [value]="sel.name ?? ''"
                   (input)="updateMeta.emit({ name: $any($event.target).value })" />
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <input type="checkbox"
                   [checked]="!!sel.showVision"
                   (change)="updateMeta.emit({ showVision: !sel.showVision, facing: sel.facing ?? (sel.type === 'away' ? 180 : 0) })" />
            Vision Cone
          </label>
          @if (sel.showVision) {
            <label class="flex items-center gap-1">
              Facing {{ sel.facing ?? 0 }}°
              <input type="range" min="0" max="355" step="5" class="w-24"
                     [value]="sel.facing ?? 0"
                     (input)="updateMeta.emit({ facing: +$any($event.target).value })" />
            </label>
          }
        }

        @if (sel.type === 'equipment') {
          <button type="button"
                  (click)="updateMeta.emit({ rotation: ((sel.rotation ?? 0) + 45) % 360 })"
                  class="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded font-semibold">
            Rotate 45° ({{ sel.rotation ?? 0 }}°)
          </button>
          <input type="color" aria-label="Equipment color"
                 class="w-6 h-5 rounded cursor-pointer bg-transparent border-0"
                 [value]="sel.color || '#f97316'"
                 (input)="updateMeta.emit({ color: $any($event.target).value })" />
        }

        @if (sel.id !== 'ball') {
          <button type="button" (click)="removeEntity.emit()"
                  class="px-2 py-0.5 bg-rose-700 hover:bg-rose-600 rounded font-semibold">
            Remove from Pitch
          </button>
        }
        <button type="button" (click)="closeInspector.emit()"
                class="ml-auto px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded">Done</button>
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
