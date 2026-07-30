import { List, ListItem, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

import { DocsFigure } from "@/components/docs/DocsFigure";
import { GUIDE_SECTION_FIGURES } from "@/lib/docs/screenshots";

function paragraphs(body: string) {
  return body
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Renders a how-to guide from a next-intl namespace that has title, subtitle,
 * and sections.{key}.{heading,body} (body may use blank lines for paragraphs).
 * Optional sections.{key}.steps is a string array rendered as an ordered list.
 * Screenshots are wired via GUIDE_SECTION_FIGURES for the same namespace.
 */
export async function DocsGuide({
  namespace,
  sections,
}: {
  namespace: string;
  sections: readonly string[];
}) {
  const t = await getTranslations(namespace);
  const figures = GUIDE_SECTION_FIGURES[namespace] ?? {};

  return (
    <Stack gap="xl" maw={720}>
      <Stack gap="sm">
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="lg">
          {t("subtitle")}
        </Text>
      </Stack>

      {sections.map((key) => {
        const stepsRaw = t.has(`sections.${key}.steps`)
          ? (t.raw(`sections.${key}.steps`) as unknown)
          : undefined;
        const steps =
          Array.isArray(stepsRaw) &&
          stepsRaw.every((s): s is string => typeof s === "string")
            ? stepsRaw
            : null;
        const figureId = figures[key];

        return (
          <Stack key={key} gap="sm" component="section">
            <Title order={3}>{t(`sections.${key}.heading`)}</Title>
            {paragraphs(t(`sections.${key}.body`)).map((paragraph) => (
              <Text key={paragraph.slice(0, 48)}>{paragraph}</Text>
            ))}
            {steps ? (
              <List type="ordered" spacing="xs" withPadding>
                {steps.map((step) => (
                  <ListItem key={step}>{step}</ListItem>
                ))}
              </List>
            ) : null}
            {figureId ? <DocsFigure id={figureId} /> : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
