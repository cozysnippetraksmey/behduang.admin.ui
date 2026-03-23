import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { PaginatedImages, UploadImageResult, MultipleUploadResult } from '../models/image.model';

@Injectable({ providedIn: 'root' })
export class ImageAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/images`;

  list(page = 1, limit = 20): Promise<PaginatedImages> {
    return firstValueFrom(
      this.http.get<PaginatedImages>(this.base, { params: { page, limit } }),
    );
  }

  /**
   * Uploads a single image as a temporary resource.
   * Returns the imageId for use when creating / updating a product.
   */
  uploadSingle(file: File): Promise<UploadImageResult> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(
      this.http.post<UploadImageResult>(`${this.base}/upload`, form),
    );
  }

  /**
   * Uploads up to 10 images in one request.
   * Partial success is possible — always check the `errors` array.
   */
  uploadMultiple(files: File[]): Promise<MultipleUploadResult> {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return firstValueFrom(
      this.http.post<MultipleUploadResult>(`${this.base}/upload-multiple`, form),
    );
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}

