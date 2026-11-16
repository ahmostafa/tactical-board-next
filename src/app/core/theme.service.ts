import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light' | 'system';

const THEME_STORAGE_KEY = 'tactical-board:theme:v1';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.getInitialMode());
  readonly systemIsDark = signal<boolean>(this.checkSystemDark());

  readonly isDark = computed(() => {
    const current = this.mode();
    if (current === 'system') {
      return this.systemIsDark();
    }
    return current === 'dark';
  });

  constructor() {
    this.setupSystemListener();

    // Sync HTML document element class whenever isDark changes
    effect(() => {
      const dark = this.isDark();
      if (typeof document !== 'undefined') {
        if (dark) {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
          document.documentElement.style.colorScheme = 'light';
        }
      }
    });
  }

  setMode(newMode: ThemeMode): void {
    this.mode.set(newMode);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, newMode);
      }
    } catch {
      // Storage unavailable in restricted sandbox
    }
  }

  toggleTheme(): void {
    const current = this.isDark();
    this.setMode(current ? 'light' : 'dark');
  }

  private getInitialMode(): ThemeMode {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          return stored;
        }
      }
    } catch {
      // fallback
    }
    return 'dark'; // default to dark mode
  }

  private checkSystemDark(): boolean {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  }

  private setupSystemListener(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', (e) => {
        this.systemIsDark.set(e.matches);
      });
    }
  }
}
