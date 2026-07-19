import { apiClient } from '@/services/api';

// ─── Workbook Types (class-centric grouped view) ──────────────────────────────

export interface WorkbookRecord {
  id: string;            // composite key: "acYearId|topic|dateKey"
  workbookName: string;  // ES-Aptitude(2nd Year,18-07-2026)
  academicYear: { id: string; name: string } | null;
  topic: string | null;
  date: string;          // ISO date string
  sessionCount: number;  // # of rooms/sessions making up this class
  totalRecords: number;  // total attendance records across all sessions
}

export interface ListWorkbooksResponse {
  success: boolean;
  message: string;
  data: WorkbookRecord[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Session Types (individual session view) ──────────────────────────────────

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
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Shared filter/response types ─────────────────────────────────────────────

export interface DeleteResponse {
  success: boolean;
  message: string;
  data?: { deletedCount?: number };
}

export interface WorkbookFilters {
  academicYear?: string;
  topic?: string;
  date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Helper: parse error body from blob responses ────────────────────────────
// When axios responseType='blob' encounters an HTTP error, the error body is
// also delivered as a Blob — so err.response.data.message won't exist.
// This helper reads the blob as text, parses the JSON, and rethrows with a
// real error message so the UI can display something meaningful.
async function throwBlobError(err: any): Promise<never> {
  if (err?.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const json = JSON.parse(text);
      const msg  = json?.message || json?.error || `Server error (${err.response.status})`;
      const enhanced = new Error(msg) as any;
      enhanced.response = { ...err.response, data: json };
      throw enhanced;
    } catch (parseErr: any) {
      if (parseErr.response) throw parseErr; // already enhanced
    }
  }
  throw err;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const sessionReportService = {

  // ── Workbook-level (grouped by class) ────────────────────────────────────────

  /** Returns grouped workbook records — one per (academicYear, topic, date) class. */
  listSessions: async (filters: WorkbookFilters = {}): Promise<ListWorkbooksResponse> => {
    const params = new URLSearchParams();
    if (filters.academicYear) params.set('academicYear', filters.academicYear);
    if (filters.topic && filters.topic !== 'All') params.set('topic', filters.topic);
    if (filters.date) params.set('date', filters.date);
    if (filters.search) params.set('search', filters.search);
    params.set('page',  String(filters.page  ?? 1));
    params.set('limit', String(filters.limit ?? 50));
    const response = await apiClient.get<ListWorkbooksResponse>(`/admin/sessions?${params.toString()}`);
    return response.data;
  },

  /** Downloads a consolidated workbook for one class (all sessions merged). */
  downloadSession: async (workbook: WorkbookRecord): Promise<void> => {
    const params = new URLSearchParams();
    if (workbook.academicYear?.id) params.set('academicYearId', workbook.academicYear.id);
    // Send topic: if null, send empty string so backend normalises it to null correctly
    params.set('topic', workbook.topic ?? '');
    params.set('date',  new Date(workbook.date).toISOString().split('T')[0]);

    let response;
    try {
      response = await apiClient.get(`/admin/sessions/download?${params.toString()}`, { responseType: 'blob' });
    } catch (err) {
      await throwBlobError(err);
    }

    const contentDisposition: string = response!.headers['content-disposition'] ?? '';
    let fileName = `${workbook.workbookName}.xlsx`;
    const match  = contentDisposition.match(/filename="([^"]+)"/);
    if (match?.[1]) fileName = match[1];

    const url  = window.URL.createObjectURL(new Blob([response!.data]));
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /** Deletes ALL sessions belonging to a workbook group. */
  deleteWorkbook: async (workbook: WorkbookRecord): Promise<DeleteResponse> => {
    const params = new URLSearchParams();
    if (workbook.academicYear?.id) params.set('academicYearId', workbook.academicYear.id);
    params.set('topic', workbook.topic || '');
    params.set('date',  new Date(workbook.date).toISOString().split('T')[0]);
    const response = await apiClient.delete<DeleteResponse>(`/admin/sessions/workbook?${params.toString()}`);
    return response.data;
  },

  // ── Session-level (individual raw sessions) ───────────────────────────────────

  /** Returns individual AttendanceSessions (not grouped) — for the Session View tab. */
  listRawSessions: async (filters: WorkbookFilters = {}): Promise<ListSessionsResponse> => {
    const params = new URLSearchParams();
    if (filters.academicYear) params.set('academicYear', filters.academicYear);
    if (filters.topic && filters.topic !== 'All') params.set('topic', filters.topic);
    if (filters.date) params.set('date', filters.date);
    if (filters.search) params.set('search', filters.search);
    params.set('page',  String(filters.page  ?? 1));
    params.set('limit', String(filters.limit ?? 50));
    const response = await apiClient.get<ListSessionsResponse>(`/admin/sessions/raw?${params.toString()}`);
    return response.data;
  },

  /**
   * Downloads a single-session worksheet (one sheet: present students + session info).
   * File name: ES-{Topic}({AcYear},{Date},{Room}).xlsx
   */
  downloadSingleSession: async (session: AttendanceSession): Promise<void> => {
    let response;
    try {
      response = await apiClient.get(`/admin/sessions/${session.id}/download`, { responseType: 'blob' });
    } catch (err) {
      await throwBlobError(err);
    }

    const contentDisposition: string = response!.headers['content-disposition'] ?? '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    const d   = new Date(session.date);
    const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    const topicFallback = session.topic || (() => {
      const sn = session.subject?.name;
      if (!sn) return 'Session';
      const idx = sn.lastIndexOf(' - ');
      return idx !== -1 ? sn.slice(idx + 3).trim() : sn.trim();
    })();
    let fileName = `ES-${topicFallback}(${session.academicYear?.name || 'All Years'},${dateStr},${session.room?.name || 'NoRoom'}).xlsx`;
    const match  = contentDisposition.match(/filename="([^"]+)"/);
    if (match?.[1]) fileName = match[1];

    const url  = window.URL.createObjectURL(new Blob([response!.data]));
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /** Deletes a single session. */
  deleteSession: async (id: string): Promise<DeleteResponse> => {
    const response = await apiClient.delete<DeleteResponse>(`/admin/sessions/${id}`);
    return response.data;
  },

  /** Bulk-deletes multiple sessions. */
  bulkDeleteSessions: async (sessionIds: string[]): Promise<DeleteResponse> => {
    const response = await apiClient.post<DeleteResponse>('/admin/sessions/bulk-delete', { sessionIds });
    return response.data;
  },
};
