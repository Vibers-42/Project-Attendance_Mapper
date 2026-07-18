import { apiClient } from '@/services/api';

export interface Student {
  id: string;
  serialNo: number | null;
  rollNumber: string;
  name: string;
  barcode: string;
  timetable: string | null;
  status: string;
  section?: { id: string; name: string } | null;
  department?: { id: string; name: string; code: string } | null;
  academicYear?: { id: string; name: string } | null;
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
    skippedCount: number;
    totalInFile: number;
  };
}

export interface AddStudentPayload {
  rollNumber: string;
  name: string;
  timetable: string;
}

export const studentService = {
  /**
   * Paginated list of students.
   * Pass q='' (or omit) to browse all; pass q='...' to filter by roll no or name.
   */
  getStudents: async (page = 1, limit = 50, query = '', academicYear = ''): Promise<GetStudentsResponse> => {
    let url = `/admin/students?page=${page}&limit=${limit}`;
    if (query && query.trim().length > 0) {
      url += `&q=${encodeURIComponent(query.trim())}`;
    }
    if (academicYear && academicYear !== 'All') {
      url += `&academicYear=${encodeURIComponent(academicYear)}`;
    }
    const response = await apiClient.get<GetStudentsResponse>(url);
    return response.data;
  },

  /** Add a single student (Roll No + Name + Timetable). */
  addStudent: async (payload: AddStudentPayload): Promise<Student> => {
    const response = await apiClient.post<{ success: boolean; message: string; data: Student }>(
      '/admin/students',
      payload,
    );
    return response.data.data;
  },

  /** Hard-delete a student by internal UUID. Cascade removes attendance records. */
  deleteStudent: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/students/${id}`);
  },

  /**
   * Additive upload — adds new students from the Excel file while
   * leaving existing records untouched.  Duplicates are skipped.
   * Required columns: "Roll No" (or alias) + "Student Name" (or alias).
   * "Timetable" column is optional.
   */
  uploadStudents: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<UploadResponse>(
      '/admin/students/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },
};
