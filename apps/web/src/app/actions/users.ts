"use server";

import type { UserDetailResponse, UserResponse } from "@repo/api-client";

import { requireAdmin } from "@/lib/auth/dal";
import { usersApi } from "@/lib/custapi/client";

const SEARCH_LIMIT = 50;

/**
 * Readonly staff user lookup against CUSTAPI `GET /users/search`.
 * Empty / short queries return no results (search-first UX).
 */
export async function searchUsers(query: string): Promise<UserResponse[]> {
  await requireAdmin();

  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  try {
    return await usersApi.usersSearchGet(q, SEARCH_LIMIT);
  } catch {
    return [];
  }
}

/** Readonly detail fetch for the selected search result. */
export async function getUserById(
  userId: string,
): Promise<UserDetailResponse | null> {
  await requireAdmin();

  try {
    return await usersApi.usersIdIdGet(userId);
  } catch {
    return null;
  }
}
