export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
