export interface SuperAdminUser {
  id: string;
  employeeId: string;
  employeeName: string;
  role: 'SUPER_ADMIN';
  isActive: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: SuperAdminUser;
    token?: string;
  };
}

export interface LoginCredentials {
  employeeId: string;
  password?: string; // Optional for MVP
}
