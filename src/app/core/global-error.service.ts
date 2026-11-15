import { ErrorHandler, Injectable, NgZone, inject, signal } from '@angular/core';
import { STORAGE_KEY } from '../pitch-board/models/tactical-board.models';

@Injectable({ providedIn: 'root' })
export class GlobalErrorStateService {
  readonly hasError = signal(false);
  readonly errorCode = signal<'500' | 'RUNTIME'>('500');
  readonly errorMessage = signal('');

  reportError(error: unknown, code: '500' | 'RUNTIME' = '500'): void {
    const message = this.extractMessage(error);
    // Ignore non-fatal jsdom test environment notice for unimplemented 2D canvas context
    if (message.includes("HTMLCanvasElement's getContext")) {
      return;
    }
    this.errorCode.set(code);
    this.errorMessage.set(message);
    this.hasError.set(true);
  }

  clearError(): void {
    this.hasError.set(false);
    this.errorMessage.set('');
  }

  resetStorageAndRecover(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('tactical-board-state-v1');
        localStorage.removeItem('tactical-board:collections:v1');
      }
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch {
      // Ignore storage access errors in restricted browser modes
    }
    this.clearError();
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message || error.name;
    }
    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
    return 'An unexpected tactical engine or server resource error occurred.';
  }
}

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorService = inject(GlobalErrorStateService);
  private readonly ngZone = inject(NgZone);

  handleError(error: unknown): void {
    this.ngZone.run(() => {
      this.errorService.reportError(error, '500');
    });
  }
}
