"use client";

import type { UserResponse } from "@repo/api-client";
import { Badge, Table } from "@mantine/core";
import { useTranslations } from "next-intl";

/**
 * Mantine's `Table.*` compound parts are assigned as properties on `Table`
 * after it's defined, not as separate named exports. Next's Turbopack build
 * for Server Components tree-shakes those assignments away (the package
 * declares `sideEffects: ["*.css"]`), so `Table.Tbody` etc. come back
 * `undefined` and crash if used directly in a Server Component. Client
 * components aren't affected — keep any `Table.*` usage in one of these.
 */
export function AdminUsersTable({ users }: { users: UserResponse[] }) {
  const t = useTranslations("staff.users.table");

  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t("name")}</Table.Th>
          <Table.Th>{t("email")}</Table.Th>
          <Table.Th>{t("role")}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {users.map((user) => (
          <Table.Tr key={user.id}>
            <Table.Td>{user.name}</Table.Td>
            <Table.Td>{user.email}</Table.Td>
            <Table.Td>
              <Badge variant="light" color={user.role === "admin" ? "grape" : "blue"}>
                {user.role}
              </Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
