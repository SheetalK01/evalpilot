import { z } from 'zod';

export const emailSchema = z
  .email('Enter a valid email')
  .max(254)
  .transform((email) => email.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // No strength rules on login: just bound the size.
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}
