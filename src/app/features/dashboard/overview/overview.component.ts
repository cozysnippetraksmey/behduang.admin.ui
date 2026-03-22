import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { ImageAdminService } from '../../../core/services/image-admin.service';
import { UserAdminService } from '../../../core/services/user-admin.service';

interface DashboardStats {
  products: number;
  images: number;
  users: number;
}

/**
 * Overview dashboard — shows high-level counts for Products, Images, and Users.
 * Fetches all three simultaneously to keep load time minimal.
 */
@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css',
})
export class OverviewComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly imageService   = inject(ImageAdminService);
  private readonly userService    = inject(UserAdminService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly stats   = signal<DashboardStats | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      // Fetch all three in parallel for speed
      const [products, images, users] = await Promise.all([
        this.productService.getAll(),
        this.imageService.list(1, 1),
        this.userService.list(1, 1),
      ]);
      this.stats.set({
        products: products.length,
        images:   images.total,
        users:    users.total,
      });
    } catch {
      this.error.set('Failed to load statistics. Please refresh the page.');
    } finally {
      this.loading.set(false);
    }
  }
}

