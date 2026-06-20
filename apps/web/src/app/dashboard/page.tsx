import type { UserMembershipResponse } from "@repo/api-client";
import {
  Badge,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { TechnicianTools } from "@/components/dashboard/TechnicianTools";
import { LinkButton } from "@/components/links";
import { LogoutButton } from "@/components/LogoutButton";
import { appRoleForSession } from "@/lib/auth/appRole";
import { requireSession } from "@/lib/auth/dal";
import { usersApi } from "@/lib/custapi/client";
import {
  myExperimentsPath,
  requestCatalogPath,
} from "@/lib/experiment/routes";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();

  const isTechnician = appRoleForSession(session) === "technician";

  let memberships: UserMembershipResponse[] = [];
  try {
    memberships = await usersApi.usersIdIdOrganizationsGet(session.userId);
  } catch {
    memberships = [];
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={1}>Welcome, {session.name}</Title>
            <Text c="dimmed" size="sm">
              {session.email}
            </Text>
          </div>
          <Group gap="sm">
            {session.role && (
              <Badge variant="light" color={session.role === "admin" ? "grape" : "blue"}>
                {session.role}
              </Badge>
            )}
            <LogoutButton />
          </Group>
        </Group>

        {!isTechnician && (
          <Card withBorder radius="md" padding="lg">
            <Stack gap="sm">
              <div>
                <Title order={3}>Experiments</Title>
                <Text c="dimmed" size="sm">
                  Request a new experiment from the lab&apos;s catalogue, or
                  track the ones you&apos;ve already submitted.
                </Text>
              </div>
              <Group gap="sm">
                <LinkButton href={requestCatalogPath()}>
                  Request an experiment
                </LinkButton>
                <LinkButton href={myExperimentsPath()} variant="light">
                  My experiments
                </LinkButton>
              </Group>
            </Stack>
          </Card>
        )}

        {isTechnician && <TechnicianTools />}

        <div>
          <Title order={3} mb="sm">
            Your organizations
          </Title>
          {memberships.length === 0 ? (
            <Text c="dimmed" size="sm">
              You are not a member of any organization yet.
            </Text>
          ) : (
            <Stack gap="sm">
              {memberships.map((membership) => (
                <Card
                  key={membership.organizationId}
                  withBorder
                  radius="md"
                  padding="md"
                >
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>
                        {membership.organization?.name ??
                          membership.organizationId}
                      </Text>
                      <Text size="xs" c="dimmed">
                        id: {membership.organizationId}
                      </Text>
                    </div>
                    {membership.role && (
                      <Badge variant="light">{membership.role}</Badge>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </div>
      </Stack>
    </Container>
  );
}
