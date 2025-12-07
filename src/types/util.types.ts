import { HttpStatus } from '@nestjs/common';
import { Prisma } from 'generated/prisma';

export type PaginationQueryType = {
  page?: number;
  limit?: number;
  sort?: 'newest';
  fields?: string[];
};

export type PaginationResponseMeta = {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type PaginationMeta = {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type PaginatedResult<T> = {
  data: T[];
} & PaginationResponseMeta;

export type PaginatedResultNew<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type TransactionClient = Prisma.TransactionClient;

type ApiSuccessResponse<T> = {
  success: true;
  data: T | T[];
} & Partial<PaginationResponseMeta>;

export type ApiErrorResponse = {
  success: false;
  message: string;
  timestamp: string;
  statusCode: HttpStatus;
  path: string;
  fields?: { field: string; message: string }[];
};
export type UnifiedApiResponse<T> = ApiSuccessResponse<T>;
