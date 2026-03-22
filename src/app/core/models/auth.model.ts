// ─── Auth domain models ────────────────────────────────────────────────────────
// Mirrors the API response shapes defined in auth.route.ts

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface AuthResult {
  user: UserProfile;
  tokens: TokenPair;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SetPasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
}

export interface ResendVerificationRequest {
  email: string;
}

