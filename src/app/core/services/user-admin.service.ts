import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AdminUser, PaginatedUsers } from '../models/user-admin.model';
import type { UserRole } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  list(page = 1, limit = 20): Promise<PaginatedUsers> {
    return firstValueFrom(
      this.http.get<PaginatedUsers>(this.base, { params: { page, limit } }),
    );
  }

  updateRole(id: string, role: UserRole): Promise<AdminUser> {
    return firstValueFrom(
      this.http.patch<AdminUser>(`${this.base}/${id}/role`, { role }),
    );
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}

