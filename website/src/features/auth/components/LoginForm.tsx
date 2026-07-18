'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '../utils/validation';
import { useLogin } from '../hooks/useLogin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

export function LoginForm() {
  const loginMutation = useLogin();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      employeeId: '',
      password: '',
    },
  });

  function onSubmit(values: LoginFormData) {
    loginMutation.mutate({
      employeeId: values.employeeId || '',
      password: values.password || '',
    });
  }

  return (
    <div className="w-full max-w-sm">
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Welcome back
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Sign in with your Super Admin credentials
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-700 dark:text-zinc-300 font-medium">Employee ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. EMP123"
                      className="h-10 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-700 focus-visible:ring-blue-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-700 dark:text-zinc-300 font-medium">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      className="h-10 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-700 focus-visible:ring-blue-500"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-10 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
