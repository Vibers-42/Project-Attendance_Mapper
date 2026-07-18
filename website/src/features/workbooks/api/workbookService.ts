import { apiClient } from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionStatus = 'CREATED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface AttendanceSession {
  id: string;
  status: SessionStatus;
  date: string;
  sessionTime: string | null;
  topic: string | null;
  labIncharge: string | null;
  labInchargeEmployeeId: string | null;
  semester: number | null;
  faculty: { id: string; facultyId: string; name: string };
  room: { id: string; name: string } | null;
  academicYear: { id: string; name: string } | null;
  subject: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
  _count: { records: number };
  createdAt: string;
}

export interface ListSessionsResponse {
  success: boolean;
  message: string;
  data: AttendanceSession[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

export interface SessionFilters {
  academicYear?: string;  // '2nd Year' | '3rd Year' | undefined
  topic?: string;         // 'Aptitude' | 'Soft Skills' | 'All' | undefined
  date?: string;          // 'YYYY-MM-DD' | undefined
  search?: string;        // Search term
  page?: number;
  limit?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const sessionReportService = {
  /**
   * Fetch paginated attendance sessions from the admin endpoint.
   * Filters: academicYear, topic, date (YYYY-MM-DD).
   */
  listSessions: async (filters: SessionFilters = {}): Promise<ListSessionsResponse> => {
    const params = new URLSearchParams();
    if (filters.academicYear) params.set('academicYear', filters.academicYear);
    if (filters.topic && filters.topic !== 'All') params.set('topic', filters.topic);
    if (filters.date) params.set('date', filters.date);
    if (filters.search) params.set('search', filters.search);
    params.set('page',  String(filters.page  ?? 1));
    params.set('limit', String(filters.limit ?? 20));

    const response = await apiClient.get<ListSessionsResponse>(
      `/admin/sessions?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Download a session workbook.
   *
   * The backend generates the Excel in memory, streams it with:
   *   Content-Disposition: attachment; filename="2ndYear_Aptitude_18-07-2026_09-30AM.xlsx"
   *
   * We extract the filename from the response header so the downloaded file
   * always uses the canonical session name from the server — never constructed
   * on the client side.
   *
   * Nothing is stored on disk (server or client). The browser triggers a
   * native file-save dialog.
   */
  downloadSession: async (id: string): Promise<void> => {
    const response = await apiClient.get(`/admin/sessions/${id}/download`, {
      responseType: 'blob',
    });

    // Extract filename from Content-Disposition header (authoritative source)
    const contentDisposition: string = response.headers['content-disposition'] ?? '';
    let fileName = 'attendance_report.xlsx';

    // Handles: attachment; filename="2ndYear_Aptitude_18-07-2026_09-30AM.xlsx"
    const match = contentDisposition.match(/filename="([^"]+)"/);
    if (match?.[1]) {
      fileName = match[1];
    }

    // Trigger native browser download
    const url  = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Delete an attendance session (and all its records via cascade).
   */
  deleteSession: async (id: string): Promise<DeleteResponse> => {
    const response = await apiClient.delete<DeleteResponse>(`/admin/sessions/${id}`);
    return response.data;
  },

  /**
   * Bulk-delete attendance sessions.
   */
  bulkDeleteSessions: async (sessionIds: string[]): Promise<DeleteResponse> => {
    const response = await apiClient.post<DeleteResponse>('/admin/sessions/bulk-delete', { sessionIds });
    return response.data;
  },
};
