import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Product, CreateProductRequest, UpdateProductRequest } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/products`;

  getAll(): Promise<Product[]> {
    return firstValueFrom(this.http.get<Product[]>(this.base));
  }

  create(data: CreateProductRequest): Promise<Product> {
    return firstValueFrom(this.http.post<Product>(this.base, data));
  }

  update(id: string, data: UpdateProductRequest): Promise<Product> {
    return firstValueFrom(this.http.patch<Product>(`${this.base}/${id}`, data));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }

  /** Upload an image first, then use the returned imageId when creating/updating a product. */
  uploadImage(file: File): Promise<{ imageId: string; url: string }> {
    const form = new FormData();
    form.append('file', file);
    return firstValueFrom(
      this.http.post<{ imageId: string; url: string }>(`${environment.apiUrl}/images/upload`, form),
    );
  }
}

