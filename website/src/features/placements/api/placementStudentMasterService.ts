import { apiClient } from '@/services/api';

export interface PlacementStudentMaster {
  id: string;
  serialNo: number | null;
  rollNumber: string;
  name: string;
  timetable: string | null;
  createdAt: string;
}

export interface FetchPlacementStudentsResponse {
  success: boolean;
  message: string;
  data: PlacementStudentMaster[];
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
    updatedCount: number;
    skippedCount: number;
    totalInFile: number;
  };
}

export const placementStudentMasterService = {
  getStudents: async (
    page: number = 1,
    limit: number = 50,
    searchQuery?: string
  ): Promise<FetchPlacementStudentsResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (searchQuery) params.append('q', searchQuery);

    const { data } = await apiClient.get<FetchPlacementStudentsResponse>(
      `/admin/placements/students?${params.toString()}`
    );
    return data;
  },

  deleteStudent: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/placements/students/${id}`);
  },

  addStudent: async (payload: { rollNumber: string; name: string; timetable?: string }): Promise<void> => {
    await apiClient.post('/admin/placements/students', payload);
  },

  uploadStudents: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<UploadResponse>(
      '/admin/placements/students/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return data;
  },
};
