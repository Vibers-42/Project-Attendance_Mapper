import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Global 401 handler: auto-logout when credentials are invalid or revoked.
// This covers: token expiry, account deletion, and privilege revocation.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== 'undefined' &&
      error?.response?.status === 401 &&
      // Only redirect if this wasn't the login request itself
      !error?.config?.url?.includes('/auth/login')
    ) {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_token');
      // Remove cookie too (js-cookie may not be available here, use plain JS)
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

