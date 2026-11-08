import { Alert, Container, Divider, Stack } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";
import { ConnectedApps } from "@/components/settings/ConnectedApps";
import { NotificationPreferencesForm } from "@/components/settings/NotificationPreferencesForm";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { SignOutEverywhere } from "@/components/settings/SignOutEverywhere";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { requireSession } from "@/lib/auth/dal";
import { usersApi } from "@/lib/custapi/client";
import { logHandledError } from "@/lib/log/handled";
import { listUserGrants, type ConnectedApp } from "@/lib/oauth/store";
import { getNotificationPreferences } from "@/lib/ticketing/notification-preferences";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";

export const dynamic = "force-dynamic";


/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting here would keep the nav and chrome off screen
 * while a backend stalls. The awaits live in the content component, under
 * `AsyncPanel`.
 */
export default function SettingsPage() {
  return (
    <AsyncPanel
      fallback={
        <Container size="sm" py="xl">
          <PanelSkeleton lines={8} />
        </Container>
      }
    >
      <SettingsPageContent />
    </AsyncPanel>
  );
}

async function SettingsPageContent() {
  const session = await requireSession();
  const t = await getTranslations("settings");
  const tNotifications = await getTranslations("settings.notifications");
  const tProfile = await getTranslations("settings.profile");
  const tConnectedApps = await getTranslations("settings.connectedApps");
  const isAdmin = session.role === "admin";
  const isClient = !isAdmin;

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

  let connectedApps: ConnectedApp[] | null = null;
  let connectedAppsLoadError: string | null = null;

  if (isAdmin) {
    try {
      connectedApps = await listUserGrants(session.userId);
    } catch (error) {
      logHandledError(error, {
        op: "settings.connectedApps",
        service: "redis",
        userId: session.userId,
      });
      connectedAppsLoadError = tConnectedApps("loadErrorFallback");
    }
  }

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

        <Divider />

        <SignOutEverywhere />

        {isAdmin && (
          <>
            <Divider />
            {connectedAppsLoadError ? (
              <Alert
                color="red"
                variant="light"
                title={tConnectedApps("loadErrorTitle")}
              >
                {connectedAppsLoadError}
              </Alert>
            ) : (
              connectedApps && <ConnectedApps apps={connectedApps} />
            )}
          </>
        )}

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
