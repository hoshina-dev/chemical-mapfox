import "server-only";

import {
  getNotificationPreferences as getPreferences,
  setNotificationPreferences,
} from "./client";

// The settings form speaks "stages" (status keys it can label); sample_tracker's
// preferences are per email event type. The mapping is fixed.
const STAGE_BY_EVENT: Record<string, string> = {
  "ticket.requested": "requested",
  "ticket.received": "received",
  "experiment.finished": "experiment_finished",
  "ticket.completed": "completed",
  "ticket.closed": "closed",
};
const EVENT_BY_STAGE = Object.fromEntries(
  Object.entries(STAGE_BY_EVENT).map(([event, stage]) => [stage, event]),
);

export type StageNotificationPreference = {
  stage: string;
  emailEnabled: boolean;
};

export type NotificationPreferences = {
  userId: string;
  preferences: StageNotificationPreference[];
};

function toStages(
  userId: string,
  rows: { eventType: string; emailEnabled: boolean }[],
): NotificationPreferences {
  return {
    userId,
    preferences: rows
      .filter((p) => STAGE_BY_EVENT[p.eventType])
      .map((p) => ({ stage: STAGE_BY_EVENT[p.eventType]!, emailEnabled: p.emailEnabled })),
  };
}

/** A user's email switches. Ownership checks stay in the BFF (session.userId). */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  return toStages(userId, await getPreferences(userId, userId));
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: StageNotificationPreference[],
): Promise<NotificationPreferences> {
  const rows = preferences
    .filter((p) => EVENT_BY_STAGE[p.stage])
    .map((p) => ({ eventType: EVENT_BY_STAGE[p.stage]!, emailEnabled: p.emailEnabled }));
  const saved = await setNotificationPreferences(userId, userId, rows);
  return toStages(userId, saved.preferences);
}
