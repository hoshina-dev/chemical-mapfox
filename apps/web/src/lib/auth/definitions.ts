import { z } from "zod";

export type CustApiRole = "admin" | "user";

export interface SessionPayload {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: CustApiRole;
  organizationId?: string;
  expiresAt: Date;
}

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: CustApiRole;
}

export const LoginFormSchema = z.object({
  email: z.email({ message: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { message: "Password is required." }),
});

export const RegisterFormSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).trim(),
  email: z.email({ message: "Please enter a valid email." }).trim(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." }),
  organizationId: z
    .uuid({ message: "Please choose an organization." })
    .trim(),
});

export type LoginFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

export type RegisterFormState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
        organizationId?: string[];
      };
      message?: string;
    }
  | undefined;
