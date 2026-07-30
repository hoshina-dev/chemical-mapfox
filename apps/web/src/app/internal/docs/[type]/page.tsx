import { findGalleryEntry, GALLERY, type QuestionType } from "@repo/forms";
import {
  Badge,
  Code,
  Group,
  Paper,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Title,
} from "@mantine/core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";

import { GalleryQuestionWorkbench } from "@/components/docs/GalleryQuestionWorkbench";
import { STAFF_DOC_RESERVED_SLUGS } from "@/lib/docs/nav";

type JsonSchemaObject = Record<string, unknown>;
type DocsTranslator = Awaited<ReturnType<typeof getTranslations<"docs">>>;
type CommonTranslator = Awaited<ReturnType<typeof getTranslations<"common">>>;

const DISCRIMINATOR_FIELD = "type";

const FIELD_DESCRIPTION_KEYS = [
  "config",
  "count",
  "itemLabel",
  "questions",
  "default",
  "description",
  "format",
  "fractions",
  "id",
  "label",
  "marks",
  "max",
  "maxLength",
  "maxRows",
  "maxTags",
  "maxValues",
  "min",
  "minLength",
  "minRows",
  "options",
  "placeholder",
  "required",
  "step",
  "suggestions",
  "swatches",
  "type",
] as const;

type FieldDescriptionKey = (typeof FIELD_DESCRIPTION_KEYS)[number];

function isFieldDescriptionKey(value: string): value is FieldDescriptionKey {
  return (FIELD_DESCRIPTION_KEYS as readonly string[]).includes(value);
}

interface PageProps {
  params: Promise<{ type: string }>;
}

export default async function GalleryDetailPage({ params }: PageProps) {
  const { type } = await params;
  if (STAFF_DOC_RESERVED_SLUGS.has(type)) notFound();
  const entry = findGalleryEntry(type);
  if (!entry) notFound();

  const t = await getTranslations("docs");
  const tCommon = await getTranslations("common");
  const jsonSchema = z.toJSONSchema(entry.zodSchema);

  return (
    <Stack gap="lg" maw={1100}>
      <Stack gap={4}>
        <Group gap="sm" align="center">
          <Title order={2}>{t(`gallery.${entry.type}.label`)}</Title>
          <Badge variant="light" color="grape" size="lg">
            {entry.type}
          </Badge>
        </Group>
        <Text c="dimmed">{t(`gallery.${entry.type}.description`)}</Text>
        <OutputValueSummary type={entry.type} t={t} />
      </Stack>

      <GalleryQuestionWorkbench
        example={entry.example}
        expectedType={entry.type}
      />

      <Paper withBorder p="md" radius="md">
        <Title order={4} mb="sm">
          {t("detail.schemaFields")}
        </Title>
        <Text size="sm" c="dimmed" mb="xs">
          {t("detail.schemaFieldsSubtitle")}
        </Text>
        <SchemaTable
          schema={jsonSchema}
          questionType={entry.type}
          t={t}
          tCommon={tCommon}
        />
      </Paper>
    </Stack>
  );
}

export function generateStaticParams() {
  return GALLERY.map((entry) => ({ type: entry.type }));
}

interface SchemaFieldRow {
  name: string;
  property: unknown;
  required: boolean;
  configSubfield?: boolean;
}

function SchemaTable({
  schema,
  questionType,
  t,
  tCommon,
}: {
  schema: unknown;
  questionType: QuestionType;
  t: DocsTranslator;
  tCommon: CommonTranslator;
}) {
  const schemaObject = asSchemaObject(schema);
  const properties = asSchemaObject(schemaObject?.properties);
  const entries = Object.entries(properties ?? {});
  const discriminator = entries.find(([name]) => name === DISCRIMINATOR_FIELD);
  const fieldEntries = entries.filter(([name]) => name !== DISCRIMINATOR_FIELD);
  const required = new Set(
    Array.isArray(schemaObject?.required)
      ? schemaObject.required.filter((item) => typeof item === "string")
      : [],
  );
  const fieldRows = buildSchemaFieldRows(fieldEntries, required);

  if (!properties) {
    return (
      <Text size="sm" c="dimmed">
        {t("detail.noFieldInfo")}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {discriminator ? (
        <DiscriminatorSummary
          property={discriminator[1]}
          required={required.has(DISCRIMINATOR_FIELD)}
          t={t}
          tCommon={tCommon}
        />
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <Table highlightOnHover verticalSpacing="sm">
          <TableThead>
            <TableTr>
              <TableTh>{t("detail.columns.field")}</TableTh>
              <TableTh>{t("detail.columns.type")}</TableTh>
              <TableTh>{t("detail.columns.required")}</TableTh>
              <TableTh>{t("detail.columns.meaning")}</TableTh>
              <TableTh>{t("detail.columns.details")}</TableTh>
            </TableTr>
          </TableThead>
          <TableTbody>
            {fieldRows.map(
              ({ name, property, required: isRequired, configSubfield }) => {
                const propertyObject = asSchemaObject(property);

                return (
                  <TableTr key={name}>
                    <TableTd>
                      <Group gap="xs" pl={configSubfield ? "md" : 0}>
                        {configSubfield ? (
                          <Text size="xs" c="dimmed">
                            {t("detail.config")}
                          </Text>
                        ) : null}
                        <Code>{name}</Code>
                      </Group>
                    </TableTd>
                    <TableTd>{describeType(propertyObject, t)}</TableTd>
                    <TableTd>
                      <Badge
                        color={isRequired ? "green" : "gray"}
                        variant="light"
                      >
                        {isRequired
                          ? t("detail.requiredYes")
                          : t("detail.requiredNo")}
                      </Badge>
                    </TableTd>
                    <TableTd>
                      <Text size="sm">
                        {fieldDescription(name, questionType, t)}
                      </Text>
                    </TableTd>
                    <TableTd>
                      <Text size="sm" c="dimmed">
                        {describeDetails(name, propertyObject, t)}
                      </Text>
                    </TableTd>
                  </TableTr>
                );
              },
            )}
          </TableTbody>
        </Table>
      </div>
    </Stack>
  );
}

function buildSchemaFieldRows(
  fieldEntries: [string, unknown][],
  required: Set<string>,
): SchemaFieldRow[] {
  const rows: SchemaFieldRow[] = [];

  for (const [name, property] of fieldEntries) {
    rows.push({ name, property, required: required.has(name) });

    if (name !== "config") continue;

    const configSchema = asSchemaObject(property);
    const configProperties = asSchemaObject(configSchema?.properties);
    if (!configProperties) continue;

    const configRequired = new Set(
      Array.isArray(configSchema?.required)
        ? configSchema.required.filter((item) => typeof item === "string")
        : [],
    );

    for (const [subName, subProperty] of Object.entries(configProperties)) {
      rows.push({
        name: `config.${subName}`,
        property: subProperty,
        required: configRequired.has(subName),
        configSubfield: true,
      });
    }
  }

  return rows;
}

function fieldDescription(
  fieldName: string,
  questionType: QuestionType,
  t: DocsTranslator,
): string {
  if (fieldName === "config.count" && questionType === "repeatable-group") {
    return t("detail.repeatableCount");
  }

  const shortName = fieldName.includes(".")
    ? fieldName.slice(fieldName.lastIndexOf(".") + 1)
    : fieldName;

  if (isFieldDescriptionKey(fieldName)) return t(`fields.${fieldName}`);
  if (isFieldDescriptionKey(shortName)) return t(`fields.${shortName}`);
  return t("detail.additionalConfig");
}

function OutputValueSummary({
  type,
  t,
}: {
  type: QuestionType;
  t: DocsTranslator;
}) {
  return (
    <div
      style={{
        background: "var(--mantine-color-teal-0)",
        border: "1px solid var(--mantine-color-teal-2)",
        borderRadius: "var(--mantine-radius-md)",
        marginTop: "var(--mantine-spacing-xs)",
        padding: "var(--mantine-spacing-sm)",
      }}
    >
      <Stack gap={4}>
        <Group gap="xs" wrap="wrap">
          <Badge color="teal" variant="filled" size="sm">
            {t("detail.outputValue")}
          </Badge>
          <Code>{t(`outputTypes.${type}.typeLabel`)}</Code>
        </Group>
        <Text size="sm" c="dimmed">
          {t(`outputTypes.${type}.description`)}
        </Text>
      </Stack>
    </div>
  );
}

function DiscriminatorSummary({
  property,
  required,
  t,
  tCommon,
}: {
  property: unknown;
  required: boolean;
  t: DocsTranslator;
  tCommon: CommonTranslator;
}) {
  const propertyObject = asSchemaObject(property);
  const constant =
    propertyObject && "const" in propertyObject
      ? formatValue(propertyObject.const)
      : tCommon("unknown");

  return (
    <div
      style={{
        background: "var(--mantine-color-grape-0)",
        border: "1px solid var(--mantine-color-grape-2)",
        borderRadius: "var(--mantine-radius-md)",
        padding: "var(--mantine-spacing-sm)",
      }}
    >
      <Stack gap={4}>
        <Group gap="xs" wrap="wrap">
          <Badge color="grape" variant="filled" size="sm">
            {t("detail.discriminator")}
          </Badge>
          <Code>{DISCRIMINATOR_FIELD}</Code>
          <Text size="sm" c="dimmed">
            {t("detail.constant")}
          </Text>
          <Code>{constant}</Code>
          {required ? (
            <Badge color="green" variant="light" size="sm">
              {t("detail.required")}
            </Badge>
          ) : null}
        </Group>
        <Text size="sm" c="dimmed">
          {t("fields.type")}
        </Text>
      </Stack>
    </div>
  );
}

function asSchemaObject(value: unknown): JsonSchemaObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonSchemaObject;
}

function describeType(
  schema: JsonSchemaObject | undefined,
  t: DocsTranslator,
): string {
  if (!schema) return t("detail.typeUnknown");

  if ("const" in schema) {
    return t("detail.typeFixedValue");
  }

  if (Array.isArray(schema.enum)) {
    return t("detail.typeOneOf");
  }

  const type = normalizeType(schema.type);

  if (type === "array") {
    return t("detail.typeArrayOf", {
      item: describeArrayItemType(schema.items, t),
    });
  }

  if (type) return titleCase(type);
  if (schema.properties) return t("detail.typeObject");

  return t("detail.typeAny");
}

function describeArrayItemType(items: unknown, t: DocsTranslator): string {
  const itemSchema = asSchemaObject(items);
  if (!itemSchema) return t("detail.typeGenericValues");

  if (itemSchema.properties) return t("detail.typeGenericObjects");

  const type = normalizeType(itemSchema.type);
  if (!type) return t("detail.typeGenericValues");

  return t("detail.typePlural", { type });
}

function describeDetails(
  fieldName: string,
  schema: JsonSchemaObject | undefined,
  t: DocsTranslator,
): string {
  if (!schema) return t("detail.noAdditionalRules");

  if (fieldName === "config.questions") {
    return t("detail.nestedQuestions");
  }

  const details: string[] = [];

  if ("const" in schema) {
    if (fieldName === DISCRIMINATOR_FIELD) {
      details.push(t("detail.discriminatorSelects"));
    } else {
      details.push(t("detail.mustMatchConstant"));
    }
  }

  if (Array.isArray(schema.enum)) {
    details.push(
      t("detail.allowedValues", {
        values: schema.enum.map(formatValue).join(", "),
      }),
    );
  }

  const itemDetails = describeArrayItems(schema.items, t);
  if (itemDetails) {
    details.push(itemDetails);
  }

  return details.join(" ") || t("detail.noAdditionalRules");
}

function describeArrayItems(
  items: unknown,
  t: DocsTranslator,
): string | undefined {
  const itemSchema = asSchemaObject(items);
  const itemProperties = asSchemaObject(itemSchema?.properties);
  if (!itemProperties) return undefined;

  const fields = Object.entries(itemProperties).map(([name, property]) => {
    const type = describeType(asSchemaObject(property), t).toLowerCase();
    return `${name} (${type})`;
  });

  return t("detail.eachItemIncludes", { fields: fields.join(", ") });
}

function normalizeType(type: unknown): string | undefined {
  if (typeof type === "string") return type;

  if (Array.isArray(type)) {
    const nonNullType = type.find(
      (item): item is string => typeof item === "string" && item !== "null",
    );
    return nonNullType;
  }

  return undefined;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  return JSON.stringify(value) ?? String(value);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
