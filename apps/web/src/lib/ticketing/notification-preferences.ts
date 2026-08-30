import "server-only";

import { loggedFetch } from "@/lib/log/downstream";

import { getTicketingUrl } from "./config";

export type StageNotificationPreference = {
  stage: string;
  emailEnabled: boolean;
};

export type NotificationPreferences = {
  userId: string;
  preferences: StageNotificationPreference[];
};

type ApiStagePreference = {
  stage: string;
  email_enabled: boolean;
};

type ApiPreferencesResponse = {
  user_id: string;
  preferences: ApiStagePreference[];
};

function mapPreferences(data: ApiPreferencesResponse): NotificationPreferences {
  return {
    userId: data.user_id,
    preferences: (data.preferences ?? []).map((p) => ({
      stage: p.stage,
      emailEnabled: p.email_enabled,
    })),
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    return body.message ?? body.error ?? response.statusText;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

/**
 * Ticketing notification preferences for a custapi user.
 * Ownership checks stay in the BFF (session.userId); ticketing has no auth.
 */
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const response = await loggedFetch(
    "ticketing",
    `${getTicketingUrl()}/api/v1/users/${encodeURIComponent(userId)}/notification-preferences`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return mapPreferences((await response.json()) as ApiPreferencesResponse);
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: StageNotificationPreference[],
): Promise<NotificationPreferences> {
  const response = await loggedFetch(
    "ticketing",
    `${getTicketingUrl()}/api/v1/users/${encodeURIComponent(userId)}/notification-preferences`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        preferences: preferences.map((p) => ({
          stage: p.stage,
          email_enabled: p.emailEnabled,
        })),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return mapPreferences((await response.json()) as ApiPreferencesResponse);
}
