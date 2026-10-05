import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { authService } from '../api/authService';
import { useAuth } from './useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoginCredentials } from '@/types/auth';

// The backend sleeps when idle (Render free tier) and the first request after
// that can fail with a gateway error or no response while it boots. Those are
// worth retrying; 4xx answers (wrong password, validation) are not.
export const isServerWakingError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return !status || status === 502 || status === 503 || status === 504;
};

export const useLogin = () => {
  const { login } = useAuth();
  const router = useRouter();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    retry: (failureCount, error) => failureCount < 4 && isServerWakingError(error),
    retryDelay: 4000,
    onSuccess: (data) => {
      if (data.success && data.data.token) {
        login(data.data.user, data.data.token);
        toast.success('Successfully logged in');
        router.push('/');
      } else {
        toast.error('Login failed. Please check your credentials.');
      }
    },
    onError: (error) => {
      const serverMessage = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      toast.error(
        serverMessage ||
          (isServerWakingError(error)
            ? 'Server is not responding. Please try again in a minute.'
            : 'An error occurred during login.')
      );
    },
  });
};
