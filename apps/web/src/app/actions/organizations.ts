"use server";

import { organizationsApi } from "@/lib/custapi/client";

export interface OrganizationOption {
  value: string;
  label: string;
}

export async function searchOrganizations(
  query: string,
): Promise<OrganizationOption[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  try {
    const organizations = await organizationsApi.organizationsSearchGet(q, 20);
    return organizations.map((org) => ({ value: org.id, label: org.name }));
  } catch {
    return [];
  }
}
