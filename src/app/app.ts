import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { PitchBoardComponent } from './pitch-board/pitch-board.component';
import { NotFoundComponent } from './core/not-found.component';
import { ServerErrorBannerComponent } from './core/server-error-banner.component';
import { GlobalErrorStateService } from './core/global-error.service';

const VALID_BOARD_PATHS = new Set([
  '',
  '/',
  '/index.html',
  '/tactical-board-next',
  '/tactical-board-next/',
  '/tactical-board-next/index.html',
]);

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PitchBoardComponent, NotFoundComponent, ServerErrorBannerComponent],
  template: `
    <main class="min-h-screen bg-gray-900 flex items-start justify-center py-2">
      @if (errorService.hasError()) {
        <app-server-error-banner
          [code]="errorService.errorCode()"
          [message]="errorService.errorMessage()"
          (dismiss)="errorService.clearError()"
          (resetStorage)="errorService.resetStorageAndRecover()"
          (reloadPage)="reloadBoard()"
        />
      }

      @if (isNotFound()) {
        <app-not-found
          [requestedPath]="currentPath()"
          (returnToPitch)="returnToBoard()"
        />
      } @else {
        <app-pitch-board class="w-full"></app-pitch-board>
      }
    </main>
  `,
})
export class App {
  protected readonly errorService = inject(GlobalErrorStateService);

  readonly currentPath = signal<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  readonly isNotFound = computed(() => !this.isValidBoardPath(this.currentPath()));

  @HostListener('window:popstate')
  onPopState(): void {
    if (typeof window !== 'undefined') {
      this.currentPath.set(window.location.pathname);
    }
  }

  isValidBoardPath(path: string): boolean {
    const normalized = path.split('?')[0].split('#')[0];
    return VALID_BOARD_PATHS.has(normalized);
  }

  setSimulatedPath(path: string): void {
    this.currentPath.set(path);
  }

  returnToBoard(): void {
    const baseHref =
      typeof document !== 'undefined'
        ? document.querySelector('base')?.getAttribute('href') || '/'
        : '/';
    const targetPath = this.isValidBoardPath(baseHref) ? baseHref : '/';
    this.currentPath.set(targetPath);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      try {
        window.history.replaceState(null, '', targetPath);
      } catch {
        // Ignore history errors in restricted test sandboxes
      }
    }
  }

  reloadBoard(): void {
    this.errorService.clearError();
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
