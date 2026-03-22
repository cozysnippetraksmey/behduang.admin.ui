import type { UserRole } from './auth.model';

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: UserRole;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

