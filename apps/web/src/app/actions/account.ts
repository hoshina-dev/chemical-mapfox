"use server";

import { CustApiResponseError } from "@repo/api-client";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/dal";
import { createSession } from "@/lib/auth/session";
import { usersApi } from "@/lib/custapi/client";
import { logHandledError } from "@/lib/log/handled";
import { uploadImageToS3 } from "@/lib/s3/client";
import { settingsPath } from "@/lib/settings/routes";

const MAX_AVATAR_BYTES = 1 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export type ProfileActionResult =
  | { success: true }
  | {
      success: false;
      error?: string;
      errors?: { name?: string[]; phoneNumber?: string[] };
    };

export type ChangePasswordActionResult =
  | { success: true }
  | {
      success: false;
      error?: string;
      errors?: {
        currentPassword?: string[];
        newPassword?: string[];
        confirmPassword?: string[];
      };
    };

async function custApiErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error instanceof CustApiResponseError) {
    try {
      const body = (await error.response.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // fall through
    }
  }
  return fallback;
}

export async function updateProfile(
  formData: FormData,
): Promise<ProfileActionResult> {
  const session = await requireSession();
  const t = await getTranslations("settings.profile");
  const tValidation = await getTranslations("settings.validation");

  const schema = z.object({
    name: z.string().min(1, { message: tValidation("nameRequired") }).trim(),
    phoneNumber: z.string().trim(),
  });

  const parsed = schema.safeParse({
    name: formData.get("name"),
    phoneNumber: formData.get("phoneNumber") ?? "",
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { name, phoneNumber } = parsed.data;
  const avatar = formData.get("avatar");

  let avatarUrl: string | undefined;
  if (avatar instanceof File && avatar.size > 0) {
    if (!ALLOWED_AVATAR_TYPES.has(avatar.type)) {
      return { success: false, error: t("avatarInvalidType") };
    }
    if (avatar.size > MAX_AVATAR_BYTES) {
      return { success: false, error: t("avatarTooLarge") };
    }
    try {
      const buffer = Buffer.from(await avatar.arrayBuffer());
      avatarUrl = await uploadImageToS3(
        buffer,
        avatar.name || "avatar.webp",
        avatar.type,
        "user-avatar",
      );
    } catch (error) {
      logHandledError(error, {
        action: "updateProfile",
        op: "avatarUpload",
        service: "s3",
        userId: session.userId,
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : t("avatarUploadFailed"),
      };
    }
  }

  try {
    const updated = await usersApi.usersIdIdPatch(session.userId, {
      name,
      phoneNumber: phoneNumber.length > 0 ? phoneNumber : "",
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
    });

    await createSession({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      role: session.role,
      organizationId: session.organizationId,
    });

    revalidatePath(settingsPath());
    return { success: true };
  } catch (error) {
    logHandledError(error, {
      action: "updateProfile",
      service: "custapi",
      userId: session.userId,
    });
    return {
      success: false,
      error: await custApiErrorMessage(error, t("saveErrorFallback")),
    };
  }
}

export async function changePassword(
  formData: FormData,
): Promise<ChangePasswordActionResult> {
  const session = await requireSession();
  const t = await getTranslations("settings.password");
  const tValidation = await getTranslations("settings.validation");

  const schema = z
    .object({
      currentPassword: z
        .string()
        .min(1, { message: tValidation("currentPasswordRequired") }),
      newPassword: z
        .string()
        .min(8, { message: tValidation("passwordMinLength") }),
      confirmPassword: z
        .string()
        .min(1, { message: tValidation("confirmPasswordRequired") }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: tValidation("passwordMismatch"),
      path: ["confirmPassword"],
    });

  const parsed = schema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    await usersApi.authVerifyPost({
      email: session.email,
      password: currentPassword,
    });
  } catch (error) {
    logHandledError(error, {
      action: "changePassword",
      op: "verifyCurrent",
      expected: true,
      userId: session.userId,
    });
    return { success: false, error: t("incorrectCurrentPassword") };
  }

  try {
    const updated = await usersApi.usersIdIdPatch(session.userId, {
      password: newPassword,
    });

    // Rotate the session cookie after a password change so a previously
    // stolen cookie cannot keep working against the new credential.
    await createSession({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      avatarUrl: updated.avatarUrl,
      role: session.role,
      organizationId: session.organizationId,
    });

    return { success: true };
  } catch (error) {
    logHandledError(error, {
      action: "changePassword",
      service: "custapi",
      userId: session.userId,
    });
    return {
      success: false,
      error: await custApiErrorMessage(error, t("saveErrorFallback")),
    };
  }
}
