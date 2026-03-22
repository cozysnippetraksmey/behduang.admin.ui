import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../core/services/product.service';
import type { Product, CreateProductRequest, UpdateProductRequest } from '../../core/models/product.model';

interface ProductForm {
  name: string;
  description: string;
  price: number | '';
  category: string;
  stock: number | '';
  imageUrl: string;
}

function emptyForm(): ProductForm {
  return { name: '', description: '', price: '', category: '', stock: '', imageUrl: '' };
}

/**
 * Products management page — full CRUD with image upload.
 *
 * Flow:
 *  1. List all products on init.
 *  2. Create: open modal → optionally upload image → submit → optimistic list update.
 *  3. Edit  : pre-fill modal → optionally replace image → submit → optimistic update.
 *  4. Delete: show confirm dialog → delete → remove from list.
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

  // ── Image upload state ───────────────────────────────────────────────────────
  readonly uploading        = signal(false);
  readonly uploadedImageId  = signal<string | null>(null);
  readonly uploadedImageUrl = signal<string | null>(null);

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
    this.uploadedImageId.set(null);
    this.uploadedImageUrl.set(null);
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
      imageUrl:    product.imageUrl ?? '',
    };
    this.uploadedImageId.set(null);
    this.uploadedImageUrl.set(null);
    this.modalMode.set('edit');
    this.editingId.set(product.id);
    this.modalError.set(null);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  // ── Image upload ─────────────────────────────────────────────────────────────

  async onImageFileChange(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.modalError.set(null);
    try {
      const result = await this.productService.uploadImage(file);
      this.uploadedImageId.set(result.imageId);
      this.uploadedImageUrl.set(result.url);
    } catch {
      this.modalError.set('Image upload failed. Please try again.');
    } finally {
      this.uploading.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  // ── Save (create or update) ───────────────────────────────────────────────────

  async onSave(): Promise<void> {
    this.saving.set(true);
    this.modalError.set(null);
    try {
      // Build payload — prefer the newly uploaded temp image over any existing URL
      const base: CreateProductRequest = {
        name:        this.form.name,
        description: this.form.description,
        price:       Number(this.form.price),
        category:    this.form.category,
        stock:       Number(this.form.stock),
      };

      if (this.uploadedImageId()) {
        base.temporaryImageId = this.uploadedImageId()!;
      } else if (this.form.imageUrl) {
        base.imageUrl = this.form.imageUrl;
      }

      if (this.modalMode() === 'create') {
        const created = await this.productService.create(base);
        this.products.update((list) => [...list, created]);
      } else {
        const payload: UpdateProductRequest = base;
        const updated = await this.productService.update(this.editingId()!, payload);
        this.products.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
      }

      this.modalOpen.set(false);
    } catch {
      this.modalError.set('Failed to save product. Please try again.');
    } finally {
      this.saving.set(false);
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

