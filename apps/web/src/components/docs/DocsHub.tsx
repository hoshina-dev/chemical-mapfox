import { Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { DocsFigure } from "@/components/docs/DocsFigure";
import { LinkAnchor } from "@/components/links";
import type { DocsNavItem } from "@/lib/docs/nav";
import { GUIDE_SECTION_FIGURES } from "@/lib/docs/screenshots";

/**
 * Docs landing page: short intro plus links to each guide (and optionally the
 * component reference). Descriptions come from docs.*.overview.links.*.
 */
export async function DocsHub({
  namespace,
  guides,
  linkNamespace,
}: {
  /** e.g. docs.staff.overview */
  namespace: string;
  guides: readonly DocsNavItem[];
  /** e.g. docs.sidebar.staffGuides — for link labels */
  linkNamespace: string;
}) {
  const t = await getTranslations(namespace);
  const tLinks = await getTranslations(linkNamespace);
  const figures = GUIDE_SECTION_FIGURES[namespace] ?? {};

  return (
    <Stack gap="xl" maw={720}>
      <Stack gap="sm">
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="lg">
          {t("subtitle")}
        </Text>
      </Stack>

      <Stack gap="sm" component="section">
        <Title order={3}>{t("sections.contents.heading")}</Title>
        <Text>{t("sections.contents.body")}</Text>
        <Stack gap="md" mt="xs">
          {guides
            .filter((item) => item.key !== "overview")
            .map((item) => (
              <Stack key={item.href} gap={4}>
                <LinkAnchor href={item.href} fw={600} size="sm">
                  {tLinks(item.key)}
                </LinkAnchor>
                <Text size="sm" c="dimmed">
                  {t(`links.${item.key}`)}
                </Text>
              </Stack>
            ))}
        </Stack>
      </Stack>

      <Stack gap="sm" component="section">
        <Title order={3}>{t("sections.lifecycle.heading")}</Title>
        {t("sections.lifecycle.body")
          .split(/\n\n+/)
          .map((paragraph) => (
            <Text key={paragraph.slice(0, 48)}>{paragraph}</Text>
          ))}
        {figures.lifecycle ? <DocsFigure id={figures.lifecycle} /> : null}
      </Stack>
    </Stack>
  );
}
