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

export function isAdmin(role?: CustApiRole): boolean {
  return role === "admin";
}

/** Human-readable label for a role, e.g. for nav/profile badges. */
export function roleLabel(role?: CustApiRole): string {
  return role === "admin" ? "Lab Staff" : "Client";
}

export interface LoginValidationMessages {
  emailInvalid: string;
  passwordRequired: string;
}

export interface RegisterValidationMessages {
  nameRequired: string;
  emailInvalid: string;
  passwordMinLength: string;
}

/**
 * Built inside server actions with `getTranslations("auth.validation")` so
 * Zod's field errors come back in the visitor's locale.
 */
export function createLoginFormSchema(messages: LoginValidationMessages) {
  return z.object({
    email: z.email({ message: messages.emailInvalid }).trim(),
    password: z.string().min(1, { message: messages.passwordRequired }),
  });
}

export function createRegisterFormSchema(messages: RegisterValidationMessages) {
  return z.object({
    name: z.string().min(1, { message: messages.nameRequired }).trim(),
    email: z.email({ message: messages.emailInvalid }).trim(),
    password: z.string().min(8, { message: messages.passwordMinLength }),
  });
}

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
      };
      message?: string;
    }
  | undefined;
