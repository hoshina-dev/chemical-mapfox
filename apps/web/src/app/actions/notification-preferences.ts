"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { requireClient } from "@/lib/auth/dal";
import { settingsPath } from "@/lib/experiment/routes";
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
    return {
      success: false,
      error: error instanceof Error ? error.message : t("saveErrorFallback"),
    };
  }
}
