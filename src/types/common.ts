export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageQuery {
  page: number;
  limit: number;
  skip: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface ServiceArea {
  district: string;
  state: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}
