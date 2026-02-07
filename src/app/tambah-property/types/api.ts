export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    details?: string;
    meta?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }
  
  export interface DraftResponse {
    success: boolean;
    data: any;
    updatedAt?: string;
    message?: string;
  }
  