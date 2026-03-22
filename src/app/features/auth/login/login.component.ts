import {
  Component,
  inject,
  signal,
  AfterViewInit,
  ElementRef,
  ViewChild,
  NgZone,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements AfterViewInit {
  private readonly fb          = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);
  private readonly ngZone      = inject(NgZone);

  @ViewChild('googleBtn') googleBtnRef!: ElementRef<HTMLDivElement>;

  // ─── Form ─────────────────────────────────────────────────────────────────────

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  // ─── UI state ─────────────────────────────────────────────────────────────────

  readonly loading      = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.initGoogleSignIn();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.errorMessage.set(null);
    this.loading.set(true);

    try {
      const { email, password } = this.form.getRawValue();
      await this.authService.loginWithEmailPassword({ email: email!, password: password! });
      await this.assertAdminAndRedirect();
    } catch (err: unknown) {
      this.errorMessage.set(this.extractMessage(err, 'Invalid email or password.'));
    } finally {
      this.loading.set(false);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  // ─── Google Sign-In ───────────────────────────────────────────────────────────

  private initGoogleSignIn(): void {
    if (typeof google === 'undefined') {
      // Script not yet loaded — wait for it
      (window as Window & { onGoogleLibraryLoad?: () => void }).onGoogleLibraryLoad =
        () => this.ngZone.run(() => this.renderGoogleButton());
      return;
    }
    this.renderGoogleButton();
  }

  private renderGoogleButton(): void {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response) => {
        // Google calls this outside Angular's zone — we must re-enter it
        this.ngZone.run(() => this.handleGoogleCallback(response.credential));
      },
    });

    if (this.googleBtnRef?.nativeElement) {
      google.accounts.id.renderButton(this.googleBtnRef.nativeElement, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 360,
      });
    }
  }

  private async handleGoogleCallback(idToken: string): Promise<void> {
    this.errorMessage.set(null);
    this.loading.set(true);

    try {
      await this.authService.loginWithGoogleIdToken(idToken);
      await this.assertAdminAndRedirect();
    } catch (err: unknown) {
      this.errorMessage.set(this.extractMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * After a successful login, verify the user is an admin.
   * If not, force logout and show an access-denied error —
   * this prevents an infinite redirect loop between /login and /dashboard.
   */
  private async assertAdminAndRedirect(): Promise<void> {
    if (!this.authService.isAdmin()) {
      await this.authService.logout();
      this.errorMessage.set('Access denied: this portal is for admins only.');
      return;
    }
    await this.redirectAfterLogin();
  }

  private async redirectAfterLogin(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
    await this.router.navigateByUrl(returnUrl);
  }

  private extractMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const apiErr = (err as { error?: { message?: string } }).error;
      if (apiErr?.message) return apiErr.message;
    }
    return fallback;
  }

  // ─── Form helpers (used in template) ──────────────────────────────────────────

  get emailControl() { return this.form.controls.email; }
  get passwordControl() { return this.form.controls.password; }
}

