"use client";

import { Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { revokeConnectedAppAction } from "@/app/actions/oauth";
import { LocalDateTime } from "@/components/LocalDateTime";
import { grantedScopes, type Scope } from "@/lib/oauth/scopes";

const SCOPE_LABEL: Record<Scope, string> = {
  "experiments:read": "scopes.read",
  "experiments:write": "scopes.experimentsWrite",
  "templates:write": "scopes.templatesWrite",
};

export type ConnectedAppItem = {
  grantId: string;
  clientName: string;
  redirectHost: string;
  scope: string;
  createdAt: number;
  lastUsedAt: number;
};

export function ConnectedApps({ apps }: { apps: ConnectedAppItem[] }) {
  const t = useTranslations("settings.connectedApps");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function disconnect(grantId: string) {
    startTransition(async () => {
      await revokeConnectedAppAction(grantId);
    });
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed">{t("subtitle")}</Text>
      </Stack>
      {apps.length === 0 ? (
        <Text c="dimmed">{t("empty")}</Text>
      ) : (
        <Stack gap="md">
          {apps.map((app) => (
            <Group
              key={app.grantId}
              justify="space-between"
              align="flex-start"
              wrap="nowrap"
            >
              <Stack gap={4}>
                <Text fw={600}>{app.clientName}</Text>
                <Text size="sm" c="dimmed">
                  {app.redirectHost}
                </Text>
                <Group gap={4} aria-label={t("access")}>
                  {[...grantedScopes(app.scope)].map((scope) => (
                    <Badge key={scope} variant="light" size="sm">
                      {t(SCOPE_LABEL[scope])}
                    </Badge>
                  ))}
                </Group>
                <Text size="sm" c="dimmed">
                  {t.rich("connectedAt", {
                    date: () => (
                      <LocalDateTime
                        iso={new Date(app.createdAt).toISOString()}
                      />
                    ),
                  })}
                </Text>
                <Text size="sm" c="dimmed">
                  {t.rich("lastUsedAt", {
                    date: () => (
                      <LocalDateTime
                        iso={new Date(app.lastUsedAt).toISOString()}
                      />
                    ),
                  })}
                </Text>
              </Stack>
              {confirmingId === app.grantId ? (
                <Stack gap="xs" align="flex-end">
                  <Text size="sm" ta="right">
                    {t("confirm", { client: app.clientName })}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      variant="default"
                      disabled={pending}
                      onClick={() => setConfirmingId(null)}
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button
                      color="red"
                      loading={pending}
                      onClick={() => disconnect(app.grantId)}
                    >
                      {tCommon("yes")}
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <Button
                  color="red"
                  variant="light"
                  disabled={pending}
                  onClick={() => setConfirmingId(app.grantId)}
                >
                  {t("disconnect")}
                </Button>
              )}
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
