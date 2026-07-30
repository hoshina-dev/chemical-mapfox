"use client";

import type { UserDetailResponse, UserResponse } from "@repo/api-client";
import {
  Badge,
  Card,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { getUserById, searchUsers } from "@/app/actions/users";

type LookupUser = Pick<UserResponse, "id" | "name" | "email" | "role">;

export function UserLookup() {
  const t = useTranslations("staff.users");
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query, 250);
  const [results, setResults] = useState<UserResponse[]>([]);
  const [selected, setSelected] = useState<LookupUser | null>(null);
  const [searching, startSearch] = useTransition();
  const [loadingDetail, startDetail] = useTransition();

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear when query too short
      setResults([]);
      return;
    }

    let active = true;
    startSearch(() => {
      void searchUsers(q).then((users) => {
        if (active) setResults(users);
      });
    });

    return () => {
      active = false;
    };
  }, [debounced]);

  function selectUser(user: UserResponse) {
    setSelected(user);
    startDetail(() => {
      void getUserById(user.id).then((detail: UserDetailResponse | null) => {
        if (detail) {
          setSelected({
            id: detail.id,
            name: detail.name,
            email: detail.email,
            role: detail.role,
          });
        }
      });
    });
  }

  const queryTooShort = query.trim().length < 2;

  return (
    <Stack gap="lg">
      <TextInput
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        rightSection={searching ? <Loader size="xs" /> : undefined}
        aria-label={t("searchLabel")}
      />

      <Card withBorder radius="md" padding="lg">
        <Title order={3} mb="sm">
          {t("resultsHeading")}
        </Title>
        {queryTooShort ? (
          <Text c="dimmed" size="sm">
            {t("typeToSearch")}
          </Text>
        ) : results.length === 0 && !searching ? (
          <Text c="dimmed" size="sm">
            {t("noUsers")}
          </Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("table.name")}</Table.Th>
                <Table.Th>{t("table.email")}</Table.Th>
                <Table.Th>{t("table.role")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {results.map((user) => {
                const active = selected?.id === user.id;
                return (
                  <Table.Tr
                    key={user.id}
                    onClick={() => selectUser(user)}
                    style={{
                      cursor: "pointer",
                      background: active
                        ? "var(--mantine-color-blue-0)"
                        : undefined,
                    }}
                    data-selected={active || undefined}
                  >
                    <Table.Td>{user.name}</Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={user.role === "admin" ? "grape" : "blue"}
                      >
                        {user.role}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" mb="sm">
          <Title order={3}>{t("detailHeading")}</Title>
          {loadingDetail && <Loader size="xs" />}
        </Group>
        {!selected ? (
          <Text c="dimmed" size="sm">
            {t("selectUser")}
          </Text>
        ) : (
          <Stack gap="xs" data-testid="user-detail">
            <DetailRow label={t("table.name")} value={selected.name} />
            <DetailRow label={t("table.email")} value={selected.email} />
            <DetailRow
              label={t("table.role")}
              value={
                <Badge
                  variant="light"
                  color={selected.role === "admin" ? "grape" : "blue"}
                >
                  {selected.role}
                </Badge>
              }
            />
            <DetailRow label={t("detailId")} value={selected.id} mono />
          </Stack>
        )}
      </Card>
    </Stack>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text size="sm" ta="right" ff={mono ? "monospace" : undefined}>
          {value}
        </Text>
      ) : (
        value
      )}
    </Group>
  );
}
