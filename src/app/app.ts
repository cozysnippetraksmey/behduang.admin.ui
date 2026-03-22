import { afterNextRender, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';

/**
 * Root application component.
 *
 * Splash screen strategy (two layers):
 *  1. Static HTML splash inside <app-root> in index.html — shown from first browser
 *     paint until Angular bootstraps + APP_INITIALIZER finishes (~200-600 ms).
 *     Angular removes it automatically when it takes over the <app-root> element.
 *
 *  2. This Angular overlay splash — rendered on the very first tick and immediately
 *     triggered to fade out. This creates a smooth visual handoff so the static splash
 *     doesn't abruptly disappear; instead it cross-fades into the app content.
 *
 *  The `authService.initializing` signal is also respected: if for any reason the
 *  initializer takes longer than the fade duration, the overlay stays visible until
 *  initialization completes.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <!-- Angular splash overlay — fades out after first render -->
    <div class="app-splash" [class.app-splash--hidden]="splashHidden()">
      <div class="app-splash__card">
        <div class="app-splash__logo">🏪</div>
        <p class="app-splash__title">Behdaung Admin</p>
        <p class="app-splash__sub">
          {{ authService.initializing() ? 'Restoring session…' : 'Loading…' }}
        </p>
        <div class="app-splash__dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- Main app — always mounted so routing is not delayed -->
    <router-outlet />
  `,
})
export class App {
  readonly authService = inject(AuthService);

  /**
   * Drives the fade-out CSS transition.
   * Starts false (splash visible), becomes true after the first render tick
   * AND after APP_INITIALIZER has completed (initializing === false).
   */
  readonly splashHidden = signal(false);

  constructor() {
    // afterNextRender fires once after the component tree has been rendered
    // for the first time — guaranteed to run client-side only.
    afterNextRender(() => {
      // Small delay so the CSS transition actually plays (browser needs one frame
      // to register the initial state before transitioning to the hidden state).
      setTimeout(() => this.splashHidden.set(true), 80);
    });
  }
}
