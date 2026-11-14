import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SavedCollectionItem } from '../models/tactical-board.models';

@Component({
  selector: 'app-collections-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-3 p-3 rounded bg-gray-800 border border-teal-600/60 text-xs flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-bold text-teal-300 text-sm">Tactical Collections Library</span>
        <input type="text" placeholder="Scheme title (e.g. Arsenal High Press 4-3-3)..."
               class="bg-gray-900 text-white px-2.5 py-1 rounded border border-gray-600 w-64"
               [value]="title()"
               (input)="titleChange.emit($any($event.target).value)" />
        <select aria-label="Scheme category"
                class="bg-gray-700 text-white rounded px-2 py-1"
                [value]="category()"
                (change)="categoryChange.emit($any($event.target).value)">
          <option value="Match Tactic">Match Tactic</option>
          <option value="Set Piece">Set Piece</option>
          <option value="Training Drill">Training Drill</option>
        </select>
        <button type="button" (click)="saveCurrent.emit()"
                class="px-3 py-1 bg-teal-600 hover:bg-teal-500 font-bold rounded">
          + Save to Collection
        </button>
        <button type="button" (click)="exportJson.emit()"
                class="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 font-semibold rounded">
          Export .JSON
        </button>
        <label class="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 font-semibold rounded cursor-pointer">
          Import .JSON
          <input type="file" accept=".json,application/json" class="hidden" (change)="importJson.emit($event)" />
        </label>
        <button type="button" (click)="closeDrawer.emit()"
                class="ml-auto px-2 py-1 bg-gray-700 rounded">Close</button>
      </div>
      @if (collections().length === 0) {
        <p class="text-gray-400">No schemes saved in your collection yet. Enter a title above and click "+ Save to Collection".</p>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pt-1">
          @for (item of collections(); track item.id) {
            <div class="flex items-center justify-between gap-2 p-2 rounded bg-gray-900/90 border border-gray-700">
              <div class="min-w-0">
                <div class="font-bold text-white truncate">{{ item.title }}</div>
                <div class="text-[11px] text-gray-400">{{ item.category }} • {{ item.frameCount }} frame(s)</div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" (click)="loadItem.emit(item)"
                        class="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 rounded font-bold">Load</button>
                <button type="button" (click)="removeItem.emit(item.id)"
                        class="px-2 py-1 bg-rose-800 hover:bg-rose-700 rounded">✕</button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CollectionsDrawerComponent {
  collections = input.required<SavedCollectionItem[]>();
  title = input.required<string>();
  category = input.required<SavedCollectionItem['category']>();

  titleChange = output<string>();
  categoryChange = output<SavedCollectionItem['category']>();
  saveCurrent = output<void>();
  exportJson = output<void>();
  importJson = output<Event>();
  loadItem = output<SavedCollectionItem>();
  removeItem = output<string>();
  closeDrawer = output<void>();
}
