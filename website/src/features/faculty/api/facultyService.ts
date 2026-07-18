import { apiClient } from '@/services/api';

export type FacultyRole = 'FACULTY' | 'SUPER_ADMIN';

export interface Faculty {
  id: string;
  facultyId: string;
  name: string;
  role: FacultyRole;
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

export interface NewFacultyCredential {
  facultyId: string;
  name: string;
  password: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    insertedCount: number;
    skippedCount: number;
    newFaculty: NewFacultyCredential[];
  };
}

export interface AddFacultyPayload {
  facultyId: string;
  name: string;
}

export interface RoleChangeResponse {
  success: boolean;
  message: string;
  data: { updatedCount: number };
}

export const facultyService = {
  /**
   * Unified paginated browse + search.
   * Pass q='' (or omit) to browse all; pass q='...' to filter by Employee ID or Name.
   */
  getFaculty: async (page = 1, limit = 50, query = '', role = ''): Promise<GetFacultyResponse> => {
    let url = `/admin/faculty?page=${page}&limit=${limit}`;
    if (query && query.trim().length > 0) {
      url += `&q=${encodeURIComponent(query.trim())}`;
    }
    if (role && role !== 'All') {
      url += `&role=${encodeURIComponent(role)}`;
    }
    const response = await apiClient.get<GetFacultyResponse>(url);
    return response.data;
  },

  /** Add a single faculty member (Employee ID + Name). Default password: webcap */
  addFaculty: async (payload: AddFacultyPayload): Promise<Faculty> => {
    const response = await apiClient.post<{ success: boolean; message: string; data: Faculty }>(
      '/admin/faculty',
      payload,
    );
    return response.data.data;
  },

  /** Hard-delete a faculty member by internal UUID. */
  deleteFaculty: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/faculty/${id}`);
  },

  /**
   * Bulk-replace Faculty Master Data from an Excel file.
   * Required columns: "Employee ID" + "Faculty Name".
   * Each faculty gets default password: webcap.
   */
  uploadFaculty: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<UploadResponse>(
      '/admin/faculty/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  /**
   * Promote one or more faculty members to SUPER_ADMIN role.
   * Gives them app login + attendance-taking at admin level.
   */
  promoteToSuperAdmin: async (ids: string[]): Promise<RoleChangeResponse> => {
    const response = await apiClient.patch<RoleChangeResponse>(
      '/admin/faculty/promote-superadmin',
      { ids },
    );
    return response.data;
  },

  /**
   * Revert one or more SUPER_ADMIN faculty back to the FACULTY role.
   */
  revokeSuperAdmin: async (ids: string[]): Promise<RoleChangeResponse> => {
    const response = await apiClient.patch<RoleChangeResponse>(
      '/admin/faculty/revoke-superadmin',
      { ids },
    );
    return response.data;
  },
};
