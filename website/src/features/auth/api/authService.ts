import { apiClient } from '@/services/api';
import { AuthResponse, LoginCredentials } from '@/types/auth';

export const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/admin/auth/login', credentials);
    return response.data;
  },

  getMe: async (): Promise<AuthResponse> => {
    const response = await apiClient.get<AuthResponse>('/admin/auth/me');
    return response.data;
  },
};
