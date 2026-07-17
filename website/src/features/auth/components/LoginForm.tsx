'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '../utils/validation';
import { useLogin } from '../hooks/useLogin';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

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
    // Current MVP behavior: we pass credentials to the dummy API 
    // which will always return success.
    loginMutation.mutate({
      employeeId: values.employeeId || '',
      password: values.password || '',
    });
  }

  return (
    <Card className="w-[400px] shadow-md border-zinc-200 dark:border-zinc-800">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight text-center">
          Super Admin Login
        </CardTitle>
        <CardDescription className="text-center">
          Enter your employee ID and password to access the dashboard.
          <br/>
          <span className="text-xs text-muted-foreground">(MVP mode: Any credentials work)</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. EMP123" {...field} />
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full mt-4" 
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
