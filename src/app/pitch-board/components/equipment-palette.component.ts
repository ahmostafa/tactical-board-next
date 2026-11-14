import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { EquipmentCatalogItem } from '../equipment-renderer';
import { EquipmentKind, PaletteDragPayload } from '../models/tactical-board.models';

@Component({
  selector: 'app-equipment-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-2 mb-2 px-3 py-2 rounded bg-gray-800/85 border border-amber-500/40 text-xs">
      <span class="font-bold text-amber-400" title="Drag any button directly onto the pitch or click to spawn">
        Drag to Pitch (or Click):
      </span>
      <button type="button"
              draggable="true"
              (dragstart)="paletteDragStart.emit({ event: $event, payload: { category: 'squad', squadType: 'home' } })"
              (click)="spawnSquad.emit({ type: 'home' })"
              class="px-2 py-1 bg-red-700 hover:bg-red-600 rounded font-semibold cursor-grab active:cursor-grabbing"
              title="Drag onto pitch or click to add a Home Player">+ Home Player</button>
      <button type="button"
              draggable="true"
              (dragstart)="paletteDragStart.emit({ event: $event, payload: { category: 'squad', squadType: 'home', roleLabel: '1', roleName: 'GK' } })"
              (click)="spawnSquad.emit({ type: 'home', label: '1', name: 'GK' })"
              class="px-2 py-1 bg-red-900 hover:bg-red-800 border border-red-400/50 rounded font-semibold cursor-grab active:cursor-grabbing"
              title="Drag onto pitch or click to add a Home Goalkeeper">+ Home GK</button>
      <button type="button"
              draggable="true"
              (dragstart)="paletteDragStart.emit({ event: $event, payload: { category: 'squad', squadType: 'away' } })"
              (click)="spawnSquad.emit({ type: 'away' })"
              class="px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded font-semibold cursor-grab active:cursor-grabbing"
              title="Drag onto pitch or click to add an Away Player">+ Away Player</button>
      <button type="button"
              draggable="true"
              (dragstart)="paletteDragStart.emit({ event: $event, payload: { category: 'squad', squadType: 'away', roleLabel: '1', roleName: 'GK' } })"
              (click)="spawnSquad.emit({ type: 'away', label: '1', name: 'GK' })"
              class="px-2 py-1 bg-blue-900 hover:bg-blue-800 border border-blue-400/50 rounded font-semibold cursor-grab active:cursor-grabbing"
              title="Drag onto pitch or click to add an Away Goalkeeper">+ Away GK</button>
      <button type="button"
              draggable="true"
              (dragstart)="paletteDragStart.emit({ event: $event, payload: { category: 'squad', squadType: 'referee' } })"
              (click)="spawnSquad.emit({ type: 'referee' })"
              class="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded font-semibold cursor-grab active:cursor-grabbing"
              title="Drag onto pitch or click to add a Referee">+ Referee</button>
      <button type="button"
              draggable="true"
              (dragstart)="paletteDragStart.emit({ event: $event, payload: { category: 'squad', squadType: 'ball' } })"
              (click)="spawnSquad.emit({ type: 'ball' })"
              class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded font-semibold cursor-grab active:cursor-grabbing"
              title="Drag onto pitch or click to add a Ball">+ Ball</button>
      <span class="text-gray-600">|</span>
      @for (item of equipmentCatalog(); track item.kind) {
        <button type="button"
                draggable="true"
                (dragstart)="paletteDragStart.emit({ event: $event, payload: { category: 'equipment', equipmentKind: item.kind, defaultColor: item.defaultColor } })"
                (click)="spawnEquipment.emit({ kind: item.kind, defaultColor: item.defaultColor })"
                class="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded font-semibold cursor-grab active:cursor-grabbing"
                [title]="'Drag ' + item.label + ' onto the pitch or click to add'">
          + {{ item.label }}
        </button>
      }
      <span class="text-gray-600">|</span>
      <button type="button"
              (click)="clearPitch.emit()"
              class="px-2 py-1 bg-rose-800 hover:bg-rose-700 rounded font-semibold"
              title="Remove all players and equipment so you have a blank pitch">
        Clear Pitch (Empty)
      </button>
    </div>
  `,
})
export class EquipmentPaletteComponent {
  equipmentCatalog = input.required<EquipmentCatalogItem[]>();

  paletteDragStart = output<{ event: DragEvent; payload: PaletteDragPayload }>();
  spawnSquad = output<{
    type: 'home' | 'away' | 'referee' | 'ball';
    label?: string;
    name?: string;
  }>();
  spawnEquipment = output<{ kind: EquipmentKind; defaultColor: string }>();
  clearPitch = output<void>();
}
