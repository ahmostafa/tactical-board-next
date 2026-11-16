import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SavedCollectionItem } from '../models/tactical-board.models';

@Component({
  selector: 'app-collections-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-3 p-3.5 rounded-lg bg-[var(--tb-bg-surface)] text-[var(--tb-text-primary)] border border-teal-600/50 shadow-md text-xs flex flex-col gap-2.5 transition-colors">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-extrabold text-teal-600 dark:text-teal-400 text-sm">Tactical Collections Library</span>
        <input type="text" placeholder="Scheme title (e.g. Arsenal High Press 4-3-3)..."
               class="bg-[var(--tb-bg-surface-elevated)] text-[var(--tb-text-primary)] px-3 py-1.5 rounded-md border border-[var(--tb-border)] w-64 min-h-[36px]"
               [value]="title()"
               (input)="titleChange.emit($any($event.target).value)" />
        <select aria-label="Scheme category"
                class="bg-[var(--tb-bg-surface-elevated)] text-[var(--tb-text-primary)] rounded-md px-2.5 py-1.5 border border-[var(--tb-border)] min-h-[36px] font-semibold"
                [value]="category()"
                (change)="categoryChange.emit($any($event.target).value)">
          <option value="Match Tactic">Match Tactic</option>
          <option value="Set Piece">Set Piece</option>
          <option value="Training Drill">Training Drill</option>
        </select>
        <button type="button" (click)="saveCurrent.emit()"
                class="px-3 py-1.5 min-h-[36px] bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-md shadow-sm transition-colors">
          + Save to Collection
        </button>
        <button type="button" (click)="exportJson.emit()"
                class="px-2.5 py-1.5 min-h-[36px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] font-semibold rounded-md transition-colors">
          Export .JSON
        </button>
        <label class="px-2.5 py-1.5 min-h-[36px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] font-semibold rounded-md cursor-pointer transition-colors inline-flex items-center">
          Import .JSON
          <input type="file" accept=".json,application/json" class="hidden" (change)="importJson.emit($event)" />
        </label>
        <button type="button" (click)="closeDrawer.emit()"
                class="ml-auto px-3 py-1.5 min-h-[36px] bg-[var(--tb-button-bg)] hover:bg-[var(--tb-button-hover)] text-[var(--tb-button-text)] border border-[var(--tb-border)] rounded-md transition-colors font-medium">Close</button>
      </div>
      @if (collections().length === 0) {
        <p class="text-[var(--tb-text-secondary)] italic">No schemes saved in your collection yet. Enter a title above and click "+ Save to Collection".</p>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pt-1">
          @for (item of collections(); track item.id) {
            <div class="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--tb-bg-surface-elevated)] border border-[var(--tb-border)] shadow-sm">
              <div class="min-w-0">
                <div class="font-bold text-[var(--tb-text-primary)] truncate">{{ item.title }}</div>
                <div class="text-[11px] text-[var(--tb-text-secondary)]">{{ item.category }} • {{ item.frameCount }} frame(s)</div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" (click)="loadItem.emit(item)"
                        class="px-2.5 py-1 min-h-[32px] bg-emerald-700 hover:bg-emerald-600 text-white rounded-md font-bold shadow-sm">Load</button>
                <button type="button" (click)="removeItem.emit(item.id)"
                        class="px-2.5 py-1 min-h-[32px] bg-rose-700 hover:bg-rose-600 text-white rounded-md font-bold shadow-sm">✕</button>
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
