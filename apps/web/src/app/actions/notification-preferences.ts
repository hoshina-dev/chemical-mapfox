"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireClient } from "@/lib/auth/dal";
import { logHandledError } from "@/lib/log/handled";
import { settingsPath } from "@/lib/settings/routes";
import {
  updateNotificationPreferences,
  type StageNotificationPreference,
} from "@/lib/ticketing/notification-preferences";

export type NotificationPreferencesActionResult =
  | { success: true; preferences: StageNotificationPreference[] }
  | { success: false; error: string };

export async function saveNotificationPreferencesAction(
  preferences: StageNotificationPreference[],
): Promise<NotificationPreferencesActionResult> {
  const session = await requireClient();
  const t = await getTranslations("settings.notifications");

  try {
    const data = await updateNotificationPreferences(
      session.userId,
      preferences,
    );
    revalidatePath(settingsPath());
    return { success: true, preferences: data.preferences };
  } catch (error) {
    logHandledError(error, {
      action: "saveNotificationPreferencesAction",
      service: "ticketing",
      userId: session.userId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : t("saveErrorFallback"),
    };
  }
}
