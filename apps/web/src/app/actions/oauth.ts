"use server";

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/dal";
import { logger } from "@/lib/log/logger";
import { revokeUserGrant } from "@/lib/oauth/store";
import { settingsPath } from "@/lib/settings/routes";

export async function revokeConnectedAppAction(grantId: string): Promise<void> {
  const session = await requireSession();
  if (await revokeUserGrant(session.userId, grantId)) {
    logger.info(
      { op: "oauth.revokeGrant", userId: session.userId, grantId },
      "connected app revoked",
    );
  }
  revalidatePath(settingsPath());
}
