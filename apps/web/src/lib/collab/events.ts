import { AnswerValue } from "@repo/forms";
import { z } from "zod";

/**
 * Field key for presence/locks/buffer. For normal questions this is the
 * `question.id`. Repeatable-group fields are locked at the group level (by the
 * group's `question.id`); their *values* are still stored per child id (a whole
 * column array), which is what `edit` carries — see CollaborativeFormRenderer.
 */
export const FieldKey = z.string().min(1);

/**
 * A `connectionId` identifies a single editing session (one tab / one device),
 * distinct from `userId`. The same user with two tabs has two connection ids,
 * so their tabs don't steal each other's locks, see each other's edits live,
 * and each tab's presence drops independently. Presence is *displayed* deduped
 * by `userId` (one avatar per person).
 */
const ConnectionId = z.string().min(1);

/** Client → server events (POSTed to `collab/event`). */
export const ClientEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("focus"), connectionId: ConnectionId, field: FieldKey }),
  z.object({ type: z.literal("blur"), connectionId: ConnectionId, field: FieldKey }),
  // The route still runs validateField for the per-question rules. Both null
  // (explicit clear) and a missing key (`JSON.stringify` drops `undefined`)
  // must parse, so a clear always propagates.
  z.object({
    type: z.literal("edit"),
    connectionId: ConnectionId,
    field: FieldKey,
    value: AnswerValue,
  }),
  z.object({ type: z.literal("heartbeat"), connectionId: ConnectionId }),
]);
export type ClientEvent = z.infer<typeof ClientEvent>;

/** One editing session in edit mode. `color` is per-user (same across a user's tabs). */
export interface PresenceEntry {
  connectionId: string;
  userId: string;
  name: string;
  avatarUrl?: string | null;
  /** Mantine color name assigned deterministically from `userId`. */
  color: string;
}

/** Map of field key → owning connectionId for the live soft locks. */
export type LockMap = Record<string, string>;

/** Server → client messages, streamed over SSE as `data: <json>`. */
export type ServerMessage =
  | {
      type: "snapshot";
      values: Record<string, AnswerValue>;
      presence: PresenceEntry[];
      locks: LockMap;
    }
  // `by` is the originating connectionId — receivers suppress their own echo
  // but apply edits from other connections (incl. the same user's other tabs).
  | { type: "edit"; field: string; value: AnswerValue; by: string }
  | { type: "lock"; field: string; by: string }
  | { type: "unlock"; field: string }
  | { type: "presence"; presence: PresenceEntry[] };
