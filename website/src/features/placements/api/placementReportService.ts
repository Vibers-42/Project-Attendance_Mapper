import { apiClient } from '@/services/api';

export interface PlacementReportRecord {
  id: string;
  title: string;
  date: string;
  time: string;
  mode: string;
  status: string;
  presentCount: number;
}

export interface PlacementReportFilters {
  page?: number;
  limit?: number;
  search?: string;
  date?: string;
}

export interface FetchPlacementReportsResponse {
  message: string;
  data: PlacementReportRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class PlacementReportService {
  /**
   * Fetch all completed placement sessions as reports.
   */
  async listReports(filters: PlacementReportFilters = {}): Promise<FetchPlacementReportsResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.search) params.append('search', filters.search);
    if (filters.date) params.append('date', filters.date);

    const response = await apiClient.get<FetchPlacementReportsResponse>(`/admin/placements/reports?${params.toString()}`);
    return response.data;
  }

  /**
   * Download the Excel workbook for a specific placement session.
   */
  async downloadReport(reportId: string): Promise<void> {
    const response = await apiClient.get(`/admin/placements/reports/${reportId}/download`, {
      responseType: 'blob',
    });

    const contentDisposition = response.headers['content-disposition'];
    let filename = 'placement_report.xlsx';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }
}

export const placementReportService = new PlacementReportService();
