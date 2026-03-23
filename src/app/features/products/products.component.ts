import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import { ImageAdminService } from '../../core/services/image-admin.service';
import type { Product, ProductImage, CreateProductRequest, UpdateProductRequest } from '../../core/models/product.model';

interface ProductForm {
  name:        string;
  description: string;
  price:       number | '';
  category:    string;
  stock:       number | '';
}

/** Tracks a single image that has been selected and is being (or has been) uploaded. */
interface PendingImage {
  /** Local-only identifier for tracking within the signal array. */
  localId:      string;
  /** Object URL for immediate in-browser preview before the upload completes. */
  previewUrl:   string;
  status:       'uploading' | 'ready' | 'error';
  /** API-assigned ID, available once status === 'ready'. */
  imageId?:     string;
  errorMessage?: string;
}

function emptyForm(): ProductForm {
  return { name: '', description: '', price: '', category: '', stock: '' };
}

/**
 * Products management page — full CRUD with multi-image upload.
 *
 * Image upload flow (create or edit):
 *  1. User clicks "+" or drops files → files immediately start uploading in parallel.
 *  2. Each file shows as a thumbnail with a spinner while uploading.
 *  3. On completion the spinner is replaced with a ✓ badge; imageId is stored.
 *  4. On submit, all ready imageIds are sent as `temporaryImageIds[]`.
 */
@Component({
  selector: 'app-products',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class ProductsComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly imageService   = inject(ImageAdminService);

  // ── List state ──────────────────────────────────────────────────────────────
  readonly products = signal<Product[]>([]);
  readonly loading  = signal(true);
  readonly error    = signal<string | null>(null);

  // ── Modal state ─────────────────────────────────────────────────────────────
  readonly modalOpen  = signal(false);
  readonly modalMode  = signal<'create' | 'edit'>('create');
  readonly editingId  = signal<string | null>(null);
  readonly saving     = signal(false);
  readonly modalError = signal<string | null>(null);

  form: ProductForm = emptyForm();

  // ── Image state ───────────────────────────────────────────────────────────────
  /** Images already saved on the product (edit mode). */
  readonly existingImages = signal<ProductImage[]>([]);
  /** Images selected in this session — may still be uploading. */
  readonly pendingImages  = signal<PendingImage[]>([]);

  /** True while at least one pending image is still uploading. */
  get anyImageUploading(): boolean {
    return this.pendingImages().some((img) => img.status === 'uploading');
  }

  // ── Delete confirm state ─────────────────────────────────────────────────────
  readonly deleteId = signal<string | null>(null);
  readonly deleting = signal(false);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.loadProducts();
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.products.set(await this.productService.getAll());
    } catch {
      this.error.set('Failed to load products. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Modal management ─────────────────────────────────────────────────────────

  openCreate(): void {
    this.form = emptyForm();
    this.existingImages.set([]);
    this.pendingImages.set([]);
    this.modalMode.set('create');
    this.editingId.set(null);
    this.modalError.set(null);
    this.modalOpen.set(true);
  }

  openEdit(product: Product): void {
    this.form = {
      name:        product.name,
      description: product.description,
      price:       product.price,
      category:    product.category,
      stock:       product.stock,
    };
    this.existingImages.set([...product.images]);
    this.pendingImages.set([]);
    this.modalMode.set('edit');
    this.editingId.set(product.id);
    this.modalError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    // Revoke all Object URLs to avoid memory leaks
    this.pendingImages().forEach((img) => URL.revokeObjectURL(img.previewUrl));
    this.pendingImages.set([]);
    this.modalOpen.set(false);
  }

  // ── Image upload ─────────────────────────────────────────────────────────────

  onImageFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const files = Array.from(input.files);
    input.value = ''; // reset so the same file can be re-selected
    this.uploadFiles(files);
  }

  removePendingImage(localId: string): void {
    const img = this.pendingImages().find((i) => i.localId === localId);
    if (img) URL.revokeObjectURL(img.previewUrl);
    this.pendingImages.update((list) => list.filter((i) => i.localId !== localId));
  }

  private uploadFiles(files: File[]): void {
    const MAX        = 10;
    const totalUsed  = this.existingImages().length + this.pendingImages().length;
    const remaining  = MAX - totalUsed;
    if (remaining <= 0) {
      this.modalError.set(`Maximum ${MAX} images per product.`);
      return;
    }

    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      this.modalError.set(`Only ${toUpload.length} image(s) added — maximum ${MAX} per product.`);
    } else {
      this.modalError.set(null);
    }

    // Create preview entries immediately so the UI responds without waiting for the network
    const entries: PendingImage[] = toUpload.map((file) => ({
      localId:    crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      status:     'uploading' as const,
    }));
    this.pendingImages.update((list) => [...list, ...entries]);

    // Upload all files concurrently; update each entry independently
    toUpload.forEach((file, idx) => {
      const localId = entries[idx].localId;
      this.imageService.uploadSingle(file).then(
        (result) => {
          this.pendingImages.update((list) =>
            list.map((img) =>
              img.localId === localId
                ? { ...img, status: 'ready' as const, imageId: result.imageId }
                : img,
            ),
          );
        },
        () => {
          this.pendingImages.update((list) =>
            list.map((img) =>
              img.localId === localId
                ? { ...img, status: 'error' as const, errorMessage: 'Upload failed' }
                : img,
            ),
          );
        },
      );
    });
  }

  // ── Save (create or update) ───────────────────────────────────────────────────

  async onSave(): Promise<void> {
    if (this.anyImageUploading) return; // wait for uploads to finish

    this.saving.set(true);
    this.modalError.set(null);
    try {
      const readyImageIds = this.pendingImages()
        .filter((img) => img.status === 'ready')
        .map((img) => img.imageId!);

      const base: CreateProductRequest = {
        name:        this.form.name,
        description: this.form.description,
        price:       Number(this.form.price),
        category:    this.form.category,
        stock:       Number(this.form.stock),
        ...(readyImageIds.length > 0 && { temporaryImageIds: readyImageIds }),
      };

      if (this.modalMode() === 'create') {
        const created = await this.productService.create(base);
        this.products.update((list) => [...list, created]);
      } else {
        const payload: UpdateProductRequest = base;
        const updated = await this.productService.update(this.editingId()!, payload);
        this.products.update((list) =>
          list.map((p) => (p.id === updated.id ? updated : p)),
        );
      }

      this.closeModal();
    } catch {
      this.modalError.set('Failed to save product. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  confirmDelete(id: string): void { this.deleteId.set(id); }
  cancelDelete():  void { this.deleteId.set(null); }

  async onDelete(): Promise<void> {
    const id = this.deleteId();
    if (!id) return;

    this.deleting.set(true);
    try {
      await this.productService.delete(id);
      this.products.update((list) => list.filter((p) => p.id !== id));
      this.deleteId.set(null);
    } catch {
      this.error.set('Failed to delete product.');
      this.deleteId.set(null);
    } finally {
      this.deleting.set(false);
    }
  }

  // ── Formatting helpers ────────────────────────────────────────────────────────

  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  }
}

