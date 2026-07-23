"use server";

import { CustApiResponseError, MemberRole } from "@repo/api-client";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import {
  createLoginFormSchema,
  createRegisterFormSchema,
  type CustApiRole,
  type LoginFormState,
  type RegisterFormState,
} from "@/lib/auth/definitions";
import { landingPathForRole } from "@/lib/auth/appRole";
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
  const tValidation = await getTranslations("auth.validation");
  const schema = createLoginFormSchema({
    emailInvalid: tValidation("emailInvalid"),
    passwordRequired: tValidation("passwordRequired"),
  });

  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;

  // Credentials are verified inside custapi (POST /auth/verify) so the bcrypt
  // hash never crosses the service boundary. custapi returns the user on
  // success and 401 on a bad email/password; treat any failure uniformly.
  let user;
  try {
    user = await usersApi.authVerifyPost({ email, password });
  } catch {
    const tErrors = await getTranslations("auth.errors");
    return { message: tErrors("invalidCredentials") };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role as CustApiRole,
    organizationId: await resolvePrimaryOrganizationId(user.id),
  });

  redirect(landingPathForRole(user.role as CustApiRole));
}

export async function register(
  _state: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const tValidation = await getTranslations("auth.validation");
  const schema = createRegisterFormSchema({
    nameRequired: tValidation("nameRequired"),
    emailInvalid: tValidation("emailInvalid"),
    passwordMinLength: tValidation("passwordMinLength"),
    organizationRequired: tValidation("organizationRequired"),
  });

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationId: formData.get("organizationId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password, organizationId } = parsed.data;
  const tErrors = await getTranslations("auth.errors");

  let created;
  try {
    created = await usersApi.usersPost({ email, name, password });
  } catch (error) {
    return {
      message: await custApiErrorMessage(
        error,
        tErrors("createAccountFailed"),
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
      message: tErrors("organizationAssignFailed"),
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

  redirect(landingPathForRole(created.role as CustApiRole));
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/");
}
