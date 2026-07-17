import { apiClient } from '@/services/api';

export interface Faculty {
  id: string;
  facultyId: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface GetFacultyResponse {
  success: boolean;
  message: string;
  data: Faculty[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    insertedCount: number;
  };
}

export const facultyService = {
  getFaculty: async (page = 1, limit = 50, query = ''): Promise<GetFacultyResponse> => {
    const endpoint = query 
      ? `/admin/faculty/search?q=${query}&limit=${limit}`
      : `/admin/faculty?page=${page}&limit=${limit}`;
      
    const response = await apiClient.get<GetFacultyResponse>(endpoint);
    if (query) {
      return {
        ...response.data,
        meta: {
          total: response.data.data.length,
          page: 1,
          limit,
          totalPages: 1
        }
      };
    }
    return response.data;
  },

  uploadFaculty: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post<UploadResponse>(
      '/admin/faculty/upload', 
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }
};
