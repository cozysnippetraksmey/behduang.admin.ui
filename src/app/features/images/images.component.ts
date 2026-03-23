import { Component, inject, OnInit, signal } from '@angular/core';
import { ImageAdminService } from '../../core/services/image-admin.service';
import type { ImageItem, UploadImageResult, UploadError } from '../../core/models/image.model';

/**
 * Images management page.
 *
 * Upload flow:
 *   1. User drags files onto the drop zone (or clicks "Select Images").
 *   2. Files are staged in `selectedFiles` — the user reviews them before sending.
 *   3. On "Upload", POST /images/upload-multiple is called.
 *   4. Results (successes + per-file errors) are shown inline; the list auto-refreshes.
 */
@Component({
  selector: 'app-images',
  standalone: true,
  imports: [],
  templateUrl: './images.component.html',
  styleUrl: './images.component.css',
})
export class ImagesComponent implements OnInit {
  private readonly imageService = inject(ImageAdminService);

  private static readonly MAX_FILES      = 10;
  private static readonly ACCEPTED_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  ]);

  // ── List state ──────────────────────────────────────────────────────────────
  readonly images  = signal<ImageItem[]>([]);
  readonly total   = signal(0);
  readonly page    = signal(1);
  readonly limit   = 20;
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  // ── Upload state ─────────────────────────────────────────────────────────────
  readonly selectedFiles = signal<File[]>([]);
  readonly isDragOver    = signal(false);
  readonly uploading     = signal(false);
  readonly uploadResults = signal<UploadImageResult[]>([]);
  readonly uploadErrors  = signal<UploadError[]>([]);

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

  // ── Upload – File selection ───────────────────────────────────────────────────

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.addFiles(Array.from(input.files));
    input.value = ''; // reset so the same file can be re-selected
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    // Only fire when the cursor truly leaves the drop zone (not a child element)
    const zone = event.currentTarget as HTMLElement;
    if (!zone.contains(event.relatedTarget as Node)) {
      this.isDragOver.set(false);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const dropped = event.dataTransfer?.files;
    if (!dropped) return;
    this.addFiles(
      Array.from(dropped).filter((f) => ImagesComponent.ACCEPTED_TYPES.has(f.type)),
    );
  }

  removeFile(index: number): void {
    this.selectedFiles.update((list) => list.filter((_, i) => i !== index));
  }

  clearAll(): void {
    this.selectedFiles.set([]);
    this.uploadResults.set([]);
    this.uploadErrors.set([]);
    this.error.set(null);
  }

  // ── Upload – Submit ───────────────────────────────────────────────────────────

  async startUpload(): Promise<void> {
    const files = this.selectedFiles();
    if (!files.length || this.uploading()) return;

    this.uploading.set(true);
    this.uploadResults.set([]);
    this.uploadErrors.set([]);
    this.error.set(null);

    try {
      const { results, errors } = await this.imageService.uploadMultiple(files);
      this.uploadResults.set(results);
      this.uploadErrors.set(errors);
      this.selectedFiles.set([]);

      if (results.length > 0) {
        await this.loadImages(); // refresh list so newly uploaded images appear
      }

      if (results.length === 0 && errors.length > 0) {
        this.error.set('All uploads failed. See the error details below.');
      }
    } catch {
      this.error.set('Upload request failed. Please check your connection and try again.');
    } finally {
      this.uploading.set(false);
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
    if (bytes < 1024)          return `${bytes} B`;
    if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private addFiles(incoming: File[]): void {
    const MAX       = ImagesComponent.MAX_FILES;
    const existing  = this.selectedFiles();
    const remaining = MAX - existing.length;

    if (remaining <= 0) {
      this.error.set(`Maximum ${MAX} images per batch already reached.`);
      return;
    }

    const toAdd = incoming.slice(0, remaining);
    this.selectedFiles.set([...existing, ...toAdd]);

    if (incoming.length > remaining) {
      this.error.set(
        `Only ${toAdd.length} file(s) added — maximum ${MAX} images per batch.`,
      );
    } else {
      this.error.set(null);
    }
  }
}
