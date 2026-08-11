import { AuthProvider } from '../../../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  email?: string;
  role: 'ADMIN' | 'VISITOR';
}

export interface AdminPayload {
  id: string;
  email: string;
  role: 'ADMIN';
}

export interface VisitorPayload {
  id: string;
  provider: AuthProvider;
  providerId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  role: 'VISITOR';
}

export interface OAuthUserPayload {
  provider: AuthProvider;
  providerId: string;
  name: string;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
