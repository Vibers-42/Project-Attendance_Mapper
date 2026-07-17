import { apiClient } from '@/services/api';

export interface GeneratedWorkbook {
  id: string;
  name: string;
  academicYearId: string | null;
  topic: string | null;
  filePath: string;
  generatedBy: string | null;
  createdAt: string;
}

export interface ListWorkbooksResponse {
  success: boolean;
  message: string;
  data: GeneratedWorkbook[];
}

export interface GenerateWorkbookResponse {
  success: boolean;
  message: string;
  data: GeneratedWorkbook;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

export const workbookService = {
  listWorkbooks: async (): Promise<ListWorkbooksResponse> => {
    const response = await apiClient.get<ListWorkbooksResponse>('/admin/workbooks');
    return response.data;
  },

  generateWorkbook: async (academicYearId?: string, topic?: string): Promise<GenerateWorkbookResponse> => {
    const response = await apiClient.post<GenerateWorkbookResponse>('/admin/workbooks/generate', {
      academicYearId,
      topic,
    });
    return response.data;
  },

  deleteWorkbook: async (id: string): Promise<DeleteResponse> => {
    const response = await apiClient.delete<DeleteResponse>(`/admin/workbooks/${id}`);
    return response.data;
  },

  bulkDeleteWorkbooks: async (ids: string[]): Promise<DeleteResponse> => {
    const response = await apiClient.delete<DeleteResponse>('/admin/workbooks/bulk', {
      data: { ids },
    });
    return response.data;
  },

  deleteAllWorkbooks: async (): Promise<DeleteResponse> => {
    const response = await apiClient.delete<DeleteResponse>('/admin/workbooks/all');
    return response.data;
  },

  downloadWorkbook: async (id: string, fileName: string): Promise<void> => {
    const response = await apiClient.get(`/admin/workbooks/${id}/download`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  }
};
