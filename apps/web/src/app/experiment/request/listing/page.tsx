import { Alert, Container, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { RequestCatalog } from "@/components/experiment/request/RequestCatalog";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { type CatalogGroup, listRequestCatalog } from "@/lib/experiment/data";
import { AsyncPanel } from "@/components/async/AsyncPanel";
import { PanelSkeleton } from "@/components/async/PanelSkeleton";

export const dynamic = "force-dynamic";


/**
 * Synchronous by design: Next withholds a route's entire HTML until the page
 * function returns, so awaiting here would keep the nav and chrome off screen
 * while a backend stalls. The awaits live in the content component, under
 * `AsyncPanel`.
 */
export default function RequestCatalogPage() {
  return (
    <AsyncPanel
      fallback={
        <Container size="xl" py="xl">
          <PanelSkeleton lines={8} />
        </Container>
      }
    >
      <RequestCatalogPageContent />
    </AsyncPanel>
  );
}

async function RequestCatalogPageContent() {
  const t = await getTranslations("experiment.request.catalog");

  let groups: CatalogGroup[] | null = null;
  let loadError: string | null = null;

  try {
    groups = await listRequestCatalog();
  } catch (error) {
    loadError = error instanceof Error ? error.message : t("loadErrorFallback");
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Breadcrumbs items={[{ label: t("breadcrumb") }]} />
        <Stack gap={4}>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed">{t("subtitle")}</Text>
        </Stack>

        {loadError && (
          <Alert color="red" variant="light" title={t("loadErrorTitle")}>
            {loadError}
          </Alert>
        )}

        {groups && <RequestCatalog groups={groups} />}
      </Stack>
    </Container>
  );
}
