/** A single image record attached to a product. */
export interface ProductImage {
  id:  string;
  url: string;
}

export interface Product {
  id:          string;
  name:        string;
  description: string;
  price:       number;
  category:    string;
  stock:       number;
  imageUrl:    string | null;
  /** All active images attached to this product (from the images table). */
  images:      ProductImage[];
}

export interface CreateProductRequest {
  name:               string;
  description:        string;
  price:              number;
  category:           string;
  stock:              number;
  imageUrl?:          string;
  /** IDs returned by POST /images/upload or /images/upload-multiple. */
  temporaryImageIds?: string[];
}

export type UpdateProductRequest = Partial<CreateProductRequest>;
