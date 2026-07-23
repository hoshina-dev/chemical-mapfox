import { Alert, Container, Stack } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { NotificationPreferencesForm } from "@/components/settings/NotificationPreferencesForm";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { requireClient } from "@/lib/auth/dal";
import { getNotificationPreferences } from "@/lib/ticketing/notification-preferences";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireClient();
  const t = await getTranslations("settings");
  const tNotifications = await getTranslations("settings.notifications");

  let preferences = null;
  let loadError: string | null = null;

  try {
    const data = await getNotificationPreferences(session.userId);
    preferences = data.preferences;
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : tNotifications("loadErrorFallback");
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Breadcrumbs items={[{ label: t("breadcrumb") }]} />

        {loadError && (
          <Alert
            color="red"
            variant="light"
            title={tNotifications("loadErrorTitle")}
          >
            {loadError}
          </Alert>
        )}

        {preferences && (
          <NotificationPreferencesForm initialPreferences={preferences} />
        )}
      </Stack>
    </Container>
  );
}
