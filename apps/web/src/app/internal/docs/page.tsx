import { GALLERY } from "@repo/forms";
import schemaJson from "@repo/forms/schema.json";
import { Anchor, Code, Stack, Text, Title } from "@mantine/core";
import { getTranslations } from "next-intl/server";

const schemaText = JSON.stringify(schemaJson, null, 2);

const TEMPLATE_EXAMPLE = `{
  "clientForm": {
    "name": "Client intake",
    "questions": [
      {
        "id": "sample_id",
        "type": "string",
        "label": "Sample ID",
        "config": { "placeholder": "SMP-001" }
      }
    ]
  },
  "labForm": {
    "name": "Lab measurements",
    "questions": []
  },
  "calculations": {
    "average": {
      "formula": "mean(values['reading'])"
    }
  },
  "values": {
    "sample_id": "SMP-001"
  }
}`;

export default async function DocsIndexPage() {
  const t = await getTranslations("docs.index");

  return (
    <Stack gap="xl" maw={860}>
      <Stack gap="md">
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed">{t("subtitle")}</Text>
        <Text size="sm" c="dimmed">
          {t("componentCount", { count: GALLERY.length })}
        </Text>
      </Stack>

      <Stack gap="sm">
        <Title order={3}>{t("templateHeading")}</Title>
        <Text>{t("templateBody")}</Text>
        <Code block>{TEMPLATE_EXAMPLE}</Code>
      </Stack>

      <Stack gap="sm">
        <Title order={3}>{t("repeatableHeading")}</Title>
        <Text>{t("repeatableBody")}</Text>
        <Anchor href="/internal/docs/repeatable-group" size="sm">
          {t("repeatableLink")}
        </Anchor>
      </Stack>

      <Stack gap="sm">
        <Title order={3}>{t("schemaHeading")}</Title>
        <Text>{t("schemaBody")}</Text>
        <details>
          <summary>
            <Text component="span" fw={600}>
              {t("fullSchema")}
            </Text>
          </summary>
          <Code block mt="sm">
            {schemaText}
          </Code>
        </details>
      </Stack>
    </Stack>
  );
}
