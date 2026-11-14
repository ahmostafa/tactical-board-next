import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TacticalEntity } from '../models/tactical-board.models';

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
}
