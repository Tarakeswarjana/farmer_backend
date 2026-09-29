import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../constants/enums';
import type { PageQuery, PaginationMeta } from '../types/common';

export function toPageQuery(input: {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): PageQuery {
  const page = input.page && input.page > 0 ? input.page : 1;
  const requested = input.limit && input.limit > 0 ? input.limit : DEFAULT_PAGE_LIMIT;
  const limit = Math.min(requested, MAX_PAGE_LIMIT);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sortBy: input.sortBy,
    sortOrder: input.sortOrder ?? 'desc',
  };
}

export function buildMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

export function buildSort(
  sortBy: string | undefined,
  sortOrder: 'asc' | 'desc',
  allowlist: readonly string[],
  fallback: string,
): Record<string, 1 | -1> {
  const field = sortBy && allowlist.includes(sortBy) ? sortBy : fallback;
  return { [field]: sortOrder === 'asc' ? 1 : -1 };
}
