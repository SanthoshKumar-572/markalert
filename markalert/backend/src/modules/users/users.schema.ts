import { z } from 'zod';

export const createFacultySchema = z.object({
  full_name: z.string().min(2, 'Full name must have at least 2 characters'),
  employee_id: z.string().min(2, 'Employee ID is required'),
  email: z.string().email('Invalid email address'),
  department: z.string().min(2, 'Department is required'),
  designation: z.string().min(2, 'Designation is required'),
  mobile_number: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const updateFacultySchema = z.object({
  full_name: z.string().min(2).optional(),
  employee_id: z.string().min(2).optional(),
  email: z.string().email().optional(),
  department: z.string().min(2).optional(),
  designation: z.string().min(2).optional(),
  mobile_number: z.string().optional(),
});

export const toggleStatusSchema = z.object({
  is_active: z.boolean(),
});

export const resetPasswordSchema = z.object({
  new_password: z.string().min(6, 'New password must be at least 6 characters long'),
});
