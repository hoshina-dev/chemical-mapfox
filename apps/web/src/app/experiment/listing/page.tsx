import { Alert, Container, Group, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { MyExperimentsBoard } from "@/components/experiment/MyExperimentsBoard";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { LinkButton } from "@/components/links";
import { requireSession } from "@/lib/auth/dal";
import { listMyExperiments, type MyExperiment } from "@/lib/experiment/data";
import { requestCatalogPath } from "@/lib/experiment/routes";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";

export const dynamic = "force-dynamic";


/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting here would keep the nav and chrome off screen
 * while a backend stalls. The awaits live in the content component, under
 * `AsyncPanel`.
 */
export default function MyExperimentsPage() {
  return (
    <AsyncPanel
      fallback={
        <Container size="xl" py="xl">
          <PanelSkeleton lines={8} />
        </Container>
      }
    >
      <MyExperimentsPageContent />
    </AsyncPanel>
  );
}

async function MyExperimentsPageContent() {
  const session = await requireSession();
  const t = await getTranslations("experiment.listing");

  let experiments: MyExperiment[] | null = null;
  let loadError: string | null = null;

  try {
    experiments = await listMyExperiments(session.userId);
  } catch (error) {
    loadError = error instanceof Error ? error.message : t("loadErrorFallback");
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs items={[{ label: t("breadcrumb") }]} />

        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={4}>
            <Title order={2}>{t("title")}</Title>
            <Text c="dimmed">{t("subtitle")}</Text>
          </Stack>
          <LinkButton href={requestCatalogPath()}>{t("requestButton")}</LinkButton>
        </Group>

        {loadError && (
          <Alert color="red" variant="light" title={t("loadErrorTitle")}>
            {loadError}
          </Alert>
        )}

        {experiments && <MyExperimentsBoard experiments={experiments} />}
      </Stack>
    </Container>
  );
}
