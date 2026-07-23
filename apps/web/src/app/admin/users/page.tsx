import type { OrganizationResponse, UserResponse } from "@repo/api-client";
import {
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { organizationsApi, usersApi } from "@/lib/custapi/client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const t = await getTranslations("staff.users");

  let users: UserResponse[] = [];
  let organizations: OrganizationResponse[] = [];
  try {
    [users, organizations] = await Promise.all([
      usersApi.usersGet(),
      organizationsApi.organizationsGet(),
    ]);
  } catch {
    users = [];
    organizations = [];
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("subtitle")}
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Card withBorder radius="md" padding="lg">
            <Text size="sm" c="dimmed">
              {t("usersCard")}
            </Text>
            <Title order={2}>{users.length}</Title>
          </Card>
          <Card withBorder radius="md" padding="lg">
            <Text size="sm" c="dimmed">
              {t("organizationsCard")}
            </Text>
            <Title order={2}>{organizations.length}</Title>
          </Card>
        </SimpleGrid>

        <Card withBorder radius="md" padding="lg">
          <Title order={3} mb="sm">
            {t("usersHeading")}
          </Title>
          {users.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t("noUsers")}
            </Text>
          ) : (
            <AdminUsersTable users={users} />
          )}
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Title order={3} mb="sm">
            {t("organizationsHeading")}
          </Title>
          {organizations.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t("noOrganizations")}
            </Text>
          ) : (
            <Stack gap="xs">
              {organizations.map((org) => (
                <Group key={org.id} justify="space-between">
                  <Text>{org.name}</Text>
                  <Text size="xs" c="dimmed">
                    {org.id}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Card>
      </Stack>
    </Container>
  );
}
