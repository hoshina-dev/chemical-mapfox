import { Alert, Container, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { RequestCatalog } from "@/components/experiment/request/RequestCatalog";
import { Breadcrumbs } from "@/components/internal/Breadcrumbs";
import { type CatalogGroup, listRequestCatalog } from "@/lib/experiment/data";

export const dynamic = "force-dynamic";

export default async function RequestCatalogPage() {
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
