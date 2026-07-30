import { Alert, Container, Divider, Stack } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { NotificationPreferencesForm } from "@/components/settings/NotificationPreferencesForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { requireSession } from "@/lib/auth/dal";
import { usersApi } from "@/lib/custapi/client";
import { getNotificationPreferences } from "@/lib/ticketing/notification-preferences";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const t = await getTranslations("settings");
  const tNotifications = await getTranslations("settings.notifications");
  const tProfile = await getTranslations("settings.profile");
  const isClient = session.role !== "admin";

  let name = session.name;
  let email = session.email;
  let phoneNumber: string | undefined;
  let avatarUrl: string | undefined = session.avatarUrl;
  let profileLoadError: string | null = null;

  try {
    const user = await usersApi.usersIdIdGet(session.userId);
    name = user.name;
    email = user.email;
    phoneNumber = user.phoneNumber;
    avatarUrl = user.avatarUrl;
  } catch (error) {
    profileLoadError =
      error instanceof Error ? error.message : tProfile("loadErrorFallback");
  }

  let preferences = null;
  let notificationsLoadError: string | null = null;

  if (isClient) {
    try {
      const data = await getNotificationPreferences(session.userId);
      preferences = data.preferences;
    } catch (error) {
      notificationsLoadError =
        error instanceof Error
          ? error.message
          : tNotifications("loadErrorFallback");
    }
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <Breadcrumbs items={[{ label: t("breadcrumb") }]} />

        {profileLoadError ? (
          <Alert
            color="red"
            variant="light"
            title={tProfile("loadErrorTitle")}
          >
            {profileLoadError}
          </Alert>
        ) : (
          <ProfileForm
            key={`${name}:${avatarUrl ?? ""}`}
            name={name}
            email={email}
            phoneNumber={phoneNumber}
            avatarUrl={avatarUrl}
          />
        )}

        <Divider />

        <ChangePasswordForm />

        {isClient && (
          <>
            <Divider />
            {notificationsLoadError && (
              <Alert
                color="red"
                variant="light"
                title={tNotifications("loadErrorTitle")}
              >
                {notificationsLoadError}
              </Alert>
            )}
            {preferences && (
              <NotificationPreferencesForm initialPreferences={preferences} />
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
