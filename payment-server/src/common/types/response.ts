export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  per_page: number;
  count: number;
}

export type TResponse<T> = Promise<{ data: T }>;

export type Paginated<T> = Promise<PaginatedResponse<T>>;
