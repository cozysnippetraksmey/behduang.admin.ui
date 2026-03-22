import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PaginatedImages } from '../models/image.model';

@Injectable({ providedIn: 'root' })
export class ImageAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/images`;

  list(page = 1, limit = 20): Promise<PaginatedImages> {
    return firstValueFrom(
      this.http.get<PaginatedImages>(this.base, { params: { page, limit } }),
    );
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}

