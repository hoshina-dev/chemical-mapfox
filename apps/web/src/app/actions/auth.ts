"use server";

import { CustApiResponseError, MemberRole } from "@repo/api-client";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";

import {
  LoginFormSchema,
  RegisterFormSchema,
  type CustApiRole,
  type LoginFormState,
  type RegisterFormState,
} from "@/lib/auth/definitions";
import { createSession, deleteSession } from "@/lib/auth/session";
import { organizationsApi, usersApi } from "@/lib/custapi/client";

async function resolvePrimaryOrganizationId(
  userId: string,
): Promise<string | undefined> {
  try {
    const memberships = await usersApi.usersIdIdOrganizationsGet(userId);
    return memberships.find((m) => m.organizationId)?.organizationId;
  } catch {
    return undefined;
  }
}

async function custApiErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error instanceof CustApiResponseError) {
    try {
      const body = (await error.response.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // fall through to the fallback message
    }
  }
  return fallback;
}

export async function login(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;

  let user;
  try {
    user = await usersApi.usersEmailEmailGet(email);
  } catch {
    return { message: "Invalid email or password." };
  }

  const passwordMatch = await compare(password, user.password);
  if (!passwordMatch) {
    return { message: "Invalid email or password." };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role as CustApiRole,
    organizationId: await resolvePrimaryOrganizationId(user.id),
  });

  redirect("/dashboard");
}

export async function register(
  _state: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const parsed = RegisterFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationId: formData.get("organizationId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password, organizationId } = parsed.data;

  let created;
  try {
    created = await usersApi.usersPost({ email, name, password });
  } catch (error) {
    return {
      message: await custApiErrorMessage(
        error,
        "Could not create your account. The email may already be in use.",
      ),
    };
  }

  try {
    await organizationsApi.organizationsIdMembersPost(organizationId, {
      userId: created.id,
      role: MemberRole.RoleMember,
    });
  } catch {
    return {
      message:
        "Your account was created, but assigning your organization failed. Please sign in and try again.",
    };
  }

  await createSession({
    id: created.id,
    name: created.name,
    email: created.email,
    avatarUrl: created.avatarUrl,
    role: created.role as CustApiRole,
    organizationId,
  });

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/");
}
