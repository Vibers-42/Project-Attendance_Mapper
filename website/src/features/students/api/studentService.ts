import { apiClient } from '@/services/api';

export interface Student {
  id: string;
  serialNo: number | null;
  rollNumber: string;
  name: string;
  barcode: string;
  timetable: string | null;
  status: string;
}

export interface GetStudentsResponse {
  success: boolean;
  message: string;
  data: Student[];
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

export const studentService = {
  getStudents: async (page = 1, limit = 50, query = ''): Promise<GetStudentsResponse> => {
    const endpoint = query 
      ? `/admin/students/search?q=${query}&limit=${limit}`
      : `/admin/students?page=${page}&limit=${limit}`;
      
    const response = await apiClient.get<GetStudentsResponse>(endpoint);
    // In case of search endpoint, it doesn't return meta, so we wrap it
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

  uploadStudents: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post<UploadResponse>(
      '/admin/students/upload', 
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
