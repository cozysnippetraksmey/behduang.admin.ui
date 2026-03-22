import { Component, inject, OnInit, signal } from '@angular/core';
import { ImageAdminService } from '../../core/services/image-admin.service';
import { ProductService } from '../../core/services/product.service';
import type { ImageItem } from '../../core/models/image.model';

/**
 * Images management page — paginated list with upload and delete.
 *
 * Upload flow: uses the ProductService.uploadImage helper (POST /images/upload)
 * which returns a temporary image record; the list then reloads to show it.
 */
@Component({
  selector: 'app-images',
  standalone: true,
  imports: [],
  templateUrl: './images.component.html',
  styleUrl: './images.component.css',
})
export class ImagesComponent implements OnInit {
  private readonly imageService   = inject(ImageAdminService);
  private readonly productService = inject(ProductService);

  // ── List state ──────────────────────────────────────────────────────────────
  readonly images  = signal<ImageItem[]>([]);
  readonly total   = signal(0);
  readonly page    = signal(1);
  readonly limit   = 20;
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  // ── Upload state ─────────────────────────────────────────────────────────────
  readonly uploading      = signal(false);
  readonly uploadSuccess  = signal<string | null>(null);

  // ── Delete confirm state ─────────────────────────────────────────────────────
  readonly deleteId = signal<string | null>(null);
  readonly deleting = signal(false);

  // ── Computed ─────────────────────────────────────────────────────────────────

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.limit));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.loadImages();
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  async loadImages(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.imageService.list(this.page(), this.limit);
      this.images.set(result.items);
      this.total.set(result.total);
    } catch {
      this.error.set('Failed to load images. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async goToPage(p: number): Promise<void> {
    if (p < 1 || p > this.totalPages) return;
    this.page.set(p);
    await this.loadImages();
  }

  // ── Upload ────────────────────────────────────────────────────────────────────

  async onUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.uploadSuccess.set(null);
    this.error.set(null);
    try {
      await this.productService.uploadImage(file);
      this.uploadSuccess.set(`"${file.name}" uploaded successfully.`);
      // Refresh the list so the new image appears
      await this.loadImages();
    } catch {
      this.error.set('Upload failed. Please try again.');
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  confirmDelete(id: string): void {
    this.deleteId.set(id);
  }

  cancelDelete(): void {
    this.deleteId.set(null);
  }

  async onDelete(): Promise<void> {
    const id = this.deleteId();
    if (!id) return;

    this.deleting.set(true);
    try {
      await this.imageService.delete(id);
      this.images.update((list) => list.filter((img) => img.id !== id));
      this.total.update((t) => t - 1);
      this.deleteId.set(null);
    } catch {
      this.error.set('Failed to delete image.');
      this.deleteId.set(null);
    } finally {
      this.deleting.set(false);
    }
  }

  // ── Formatting helpers ────────────────────────────────────────────────────────

  formatBytes(bytes: number): string {
    if (bytes < 1024)           return `${bytes} B`;
    if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }
}

