import { Component, inject, OnInit, signal } from '@angular/core';
import { UserAdminService } from '../../core/services/user-admin.service';
import { AuthService } from '../../core/services/auth.service';
import type { AdminUser } from '../../core/models/user-admin.model';
import type { UserRole } from '../../core/models/auth.model';

/**
 * Users management page — paginated list with role management and delete.
 *
 * Guards:
 *  - An admin cannot change their own role (would lock themselves out).
 *  - An admin cannot delete their own account.
 *  These are enforced both here (UI) and on the API.
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class UsersComponent implements OnInit {
  private readonly userService = inject(UserAdminService);
  private readonly authService = inject(AuthService);

  // ── List state ──────────────────────────────────────────────────────────────
  readonly users   = signal<AdminUser[]>([]);
  readonly total   = signal(0);
  readonly page    = signal(1);
  readonly limit   = 20;
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  // Current admin's ID — used to disable self-actions in the UI
  readonly currentUserId = this.authService.currentUser()?.id ?? '';

  // ── Role update state ────────────────────────────────────────────────────────
  readonly updatingRoleId = signal<string | null>(null);

  // ── Delete confirm state ─────────────────────────────────────────────────────
  readonly deleteId    = signal<string | null>(null);
  readonly deleteUser  = signal<AdminUser | null>(null);
  readonly deleting    = signal(false);

  // ── Computed ─────────────────────────────────────────────────────────────────

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.limit));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.loadUsers();
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.userService.list(this.page(), this.limit);
      this.users.set(result.items);
      this.total.set(result.total);
    } catch {
      this.error.set('Failed to load users. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async goToPage(p: number): Promise<void> {
    if (p < 1 || p > this.totalPages) return;
    this.page.set(p);
    await this.loadUsers();
  }

  // ── Role management ───────────────────────────────────────────────────────────

  async toggleRole(user: AdminUser): Promise<void> {
    if (user.id === this.currentUserId) return;

    const newRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    this.updatingRoleId.set(user.id);
    this.success.set(null);
    this.error.set(null);

    try {
      const updated = await this.userService.updateRole(user.id, newRole);
      this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      this.success.set(`${updated.name ?? updated.email} is now ${updated.role}.`);
    } catch (e: unknown) {
      const msg = (e as { error?: { message?: string } })?.error?.message;
      this.error.set(msg ?? 'Failed to update role. Please try again.');
    } finally {
      this.updatingRoleId.set(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  openDeleteConfirm(user: AdminUser): void {
    this.deleteId.set(user.id);
    this.deleteUser.set(user);
  }

  cancelDelete(): void {
    this.deleteId.set(null);
    this.deleteUser.set(null);
  }

  async onDelete(): Promise<void> {
    const id = this.deleteId();
    if (!id) return;

    this.deleting.set(true);
    try {
      await this.userService.delete(id);
      this.users.update((list) => list.filter((u) => u.id !== id));
      this.total.update((t) => t - 1);
      this.deleteId.set(null);
      this.deleteUser.set(null);
    } catch {
      this.error.set('Failed to delete user.');
      this.cancelDelete();
    } finally {
      this.deleting.set(false);
    }
  }

  // ── Formatting helpers ────────────────────────────────────────────────────────

  getInitial(user: AdminUser): string {
    return (user.name ?? user.email).charAt(0).toUpperCase();
  }

  formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }
}

