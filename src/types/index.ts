import { OrderStatus, PaymentMethod, PaymentStatus, RefundStatus, EntityType, ActionType, EnquiryStatus, UserRole, UserStatus } from '@prisma/client';

export type { OrderStatus, PaymentMethod, PaymentStatus, RefundStatus, EntityType, ActionType, EnquiryStatus, UserRole, UserStatus };

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuthToken {
  userId: string;
  email: string;
  role: string;
}

export interface CustomerAuthToken {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthToken;
      customer?: CustomerAuthToken;
      validated?: any;
    }
  }
}
