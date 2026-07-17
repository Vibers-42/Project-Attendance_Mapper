import { useMutation } from '@tanstack/react-query';
import { authService } from '../api/authService';
import { useAuth } from './useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LoginCredentials } from '@/types/auth';

export const useLogin = () => {
  const { login } = useAuth();
  const router = useRouter();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (data) => {
      if (data.success && data.data.token) {
        login(data.data.user, data.data.token);
        toast.success('Successfully logged in');
        router.push('/');
      } else {
        toast.error('Login failed. Please check your credentials.');
      }
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || 'An error occurred during login.'
      );
    },
  });
};
