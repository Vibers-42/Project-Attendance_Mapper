import * as z from 'zod';

export const loginSchema = z.object({
  employeeId: z.string().optional(), // Optional for MVP
  password: z.string().optional(), // Optional for MVP
});

export type LoginFormData = z.infer<typeof loginSchema>;
