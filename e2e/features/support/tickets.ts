import { CHEMFOX_ORG_ID, findUserByEmail } from "./fixtures.js";
import {
  seedTicket,
  type SeedTicketInput,
  type TicketStatus,
} from "./stub/modules/experiment-manager.js";

const STATUSES: TicketStatus[] = [
  "REQUESTED",
  "RECEIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
];

/** A experiment-manager ticket status from a feature table ("in progress", "IN_PROGRESS"). */
export function toStatus(raw: string | undefined): TicketStatus {
  const status = (raw?.trim() || "REQUESTED")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!STATUSES.includes(status as TicketStatus)) {
    throw new Error(
      `unknown ticket status "${raw}" (use one of ${STATUSES.join(", ")})`,
    );
  }
  return status as TicketStatus;
}

/** Seed a ticket requested by the fixture user with `email` (or a stand-in requester). */
export function seedTicketFor(
  email: string | undefined,
  input: Omit<SeedTicketInput, "requesterUserId" | "organizationId">,
) {
  const user = email ? findUserByEmail(email) : undefined;
  if (email && !user)
    throw new Error(`no fixture user exists for email "${email}"`);
  return seedTicket({
    ...input,
    requesterUserId: user?.id ?? "00000000-0000-4000-8000-0000000000aa",
    organizationId: user?.organizationIds[0] ?? CHEMFOX_ORG_ID,
  });
}
