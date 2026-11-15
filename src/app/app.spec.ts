import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { GlobalErrorHandler, GlobalErrorStateService } from './core/global-error.service';
import { APP_VERSION } from '../environments/version';
import { STORAGE_KEY } from './pitch-board/models/tactical-board.models';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }],
    }).compileComponents();

    TestBed.inject(GlobalErrorStateService).clearError();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render tactical board toolbar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Draw Tactical Arrows');
    expect(compiled.textContent).toContain('Collections');
  });

  it(`should display the About button with version ${APP_VERSION} and open the About modal`, async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const aboutBtn = compiled.querySelector('[data-testid="about-button"]') as HTMLButtonElement | null;
    expect(aboutBtn).toBeTruthy();
    expect(aboutBtn?.textContent).toContain(APP_VERSION);

    aboutBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const modal = compiled.querySelector('[data-testid="about-modal"]') as HTMLElement | null;
    expect(modal).toBeTruthy();

    const badge = compiled.querySelector('[data-testid="about-version-badge"]') as HTMLElement | null;
    expect(badge?.textContent).toContain(APP_VERSION);
    expect(modal?.textContent).toContain('Ahmed Mohamed');
    expect(modal?.textContent).toContain('ISC');

    const closeBtn = compiled.querySelector('[data-testid="close-about-btn"]') as HTMLButtonElement | null;
    closeBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('[data-testid="about-modal"]')).toBeNull();
  });

  it('should handle 404 Page Not Available for unknown routes and return to board', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();

    app.setSimulatedPath('/tactical-board-next/non-existent-page');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const notFoundView = compiled.querySelector('[data-testid="not-found-view"]') as HTMLElement | null;
    expect(notFoundView).toBeTruthy();
    expect(notFoundView?.textContent).toContain('404');
    expect(notFoundView?.textContent).toContain('Out of Bounds');
    expect(notFoundView?.textContent).toContain('/tactical-board-next/non-existent-page');

    const returnBtn = compiled.querySelector('[data-testid="return-to-pitch-btn"]') as HTMLButtonElement | null;
    returnBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('[data-testid="not-found-view"]')).toBeNull();
    expect(compiled.textContent).toContain('Draw Tactical Arrows');
  });

  it('should handle 500 / server runtime errors via GlobalErrorStateService and recover', async () => {
    const fixture = TestBed.createComponent(App);
    const errorHandler = TestBed.inject(ErrorHandler);
    await fixture.whenStable();

    localStorage.setItem(STORAGE_KEY, '{"corrupted":true}');
    errorHandler.handleError(new Error('Simulated 500 CDN asset failure'));
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorView = compiled.querySelector('[data-testid="server-error-view"]') as HTMLElement | null;
    expect(errorView).toBeTruthy();
    expect(errorView?.textContent).toContain('500');
    expect(errorView?.textContent).toContain('Simulated 500 CDN asset failure');

    const resetBtn = compiled.querySelector('[data-testid="reset-storage-btn"]') as HTMLButtonElement | null;
    resetBtn?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(compiled.querySelector('[data-testid="server-error-view"]')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
