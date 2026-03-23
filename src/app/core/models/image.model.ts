export interface ImageItem {
  id: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  status: 'temp' | 'active';
  productId: string | null;
  productName: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface PaginatedImages {
  items: ImageItem[];
  total: number;
  page: number;
  limit: number;
}

export interface UploadImageResult {
  imageId: string;
  url: string;
  status: 'temp';
  expiresAt: string;
}

/** Per-file failure detail returned by POST /images/upload-multiple. */
export interface UploadError {
  filename: string;
  message: string;
}

/** Response shape from POST /images/upload-multiple (partial success is possible). */
export interface MultipleUploadResult {
  results: UploadImageResult[];
  errors: UploadError[];
}

