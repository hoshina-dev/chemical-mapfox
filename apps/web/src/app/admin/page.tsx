import type { OrganizationResponse, UserResponse } from "@repo/api-client";
import {
  Badge,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";

import { requireAdmin } from "@/lib/auth/dal";
import { organizationsApi, usersApi } from "@/lib/custapi/client";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

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
          <Title order={1}>Admin</Title>
          <Text c="dimmed" size="sm">
            Mapfox-admin tools for managing every user and organization.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Card withBorder radius="md" padding="lg">
            <Text size="sm" c="dimmed">
              Users
            </Text>
            <Title order={2}>{users.length}</Title>
          </Card>
          <Card withBorder radius="md" padding="lg">
            <Text size="sm" c="dimmed">
              Organizations
            </Text>
            <Title order={2}>{organizations.length}</Title>
          </Card>
        </SimpleGrid>

        <Card withBorder radius="md" padding="lg">
          <Title order={3} mb="sm">
            Users
          </Title>
          {users.length === 0 ? (
            <Text c="dimmed" size="sm">
              No users found.
            </Text>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Role</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user.id}>
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
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Title order={3} mb="sm">
            Organizations
          </Title>
          {organizations.length === 0 ? (
            <Text c="dimmed" size="sm">
              No organizations found.
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
