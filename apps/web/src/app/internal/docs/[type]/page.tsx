import {
  findGalleryEntry,
  GALLERY,
  type QuestionType,
} from "@repo/forms";
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
import { notFound } from "next/navigation";
import { z } from "zod";

import { GalleryQuestionWorkbench } from "@/components/docs/GalleryQuestionWorkbench";

type JsonSchemaObject = Record<string, unknown>;

const DISCRIMINATOR_FIELD = "type";

const FIELD_DESCRIPTIONS: Record<string, string> = {
  config: "Type-specific configuration object.",
  count: "Number of rating icons to display.",
  itemLabel: "Singular noun for one repetition, e.g. 'Measurement'.",
  questions: "Child questions repeated each iteration.",
  default: "Initial value used before the user changes the answer.",
  description: "Optional helper text shown under the question label.",
  format: "Color value format accepted by the color input.",
  fractions: "Fractional precision for rating values.",
  id: "Stable answer key used when storing or reading this value.",
  label: "Question text shown to the user.",
  marks: "Visible labels placed along a slider.",
  max: "Largest accepted value.",
  maxLength: "Maximum number of characters.",
  maxRows: "Maximum visible textarea rows.",
  maxTags: "Maximum number of tags the user can add.",
  maxValues: "Maximum number of choices the user can select.",
  min: "Smallest accepted value.",
  minLength: "Minimum number of characters.",
  minRows: "Minimum visible textarea rows.",
  options: "Choices available to the user.",
  placeholder: "Hint text shown before a value is entered.",
  required: "Whether the user must answer this question.",
  step: "Increment used by numeric controls.",
  suggestions: "Suggested tags offered while typing.",
  swatches: "Preset color choices shown by the color input.",
  type: "Discriminator field that chooses the question schema and renderer.",
};

const OUTPUT_VALUE_TYPES: Record<
  QuestionType,
  { typeLabel: string; description: string }
> = {
  boolean: {
    typeLabel: "boolean",
    description: "Stored as true or false.",
  },
  "checkbox-group": {
    typeLabel: "string[]",
    description: "Stored as an array of selected option values.",
  },
  color: {
    typeLabel: "string | undefined",
    description:
      "Stored as a color string in the configured format, or undefined when empty.",
  },
  date: {
    typeLabel: "string | undefined",
    description: "Stored as a yyyy-MM-dd date string, or undefined when empty.",
  },
  datetime: {
    typeLabel: "string | undefined",
    description:
      "Stored as a yyyy-MM-ddTHH:mm datetime string, or undefined when empty.",
  },
  "multi-select": {
    typeLabel: "string[]",
    description: "Stored as an array of selected option values.",
  },
  number: {
    typeLabel: "number | undefined",
    description: "Stored as a number, or undefined when empty.",
  },
  password: {
    typeLabel: "string | undefined",
    description: "Stored as the entered string, or undefined when empty.",
  },
  radio: {
    typeLabel: "string | undefined",
    description:
      "Stored as the selected option value, or undefined when nothing is selected.",
  },
  rating: {
    typeLabel: "number | undefined",
    description: "Stored as a number, or undefined when no rating is selected.",
  },
  segmented: {
    typeLabel: "string | undefined",
    description:
      "Stored as the selected segment value, or undefined when empty.",
  },
  "select-number": {
    typeLabel: "number | undefined",
    description:
      "Stored as the selected numeric option value, or undefined when empty.",
  },
  "select-string": {
    typeLabel: "string | undefined",
    description:
      "Stored as the selected string option value, or undefined when empty.",
  },
  slider: {
    typeLabel: "number | undefined",
    description:
      "Stored as a number after the slider changes; it may be undefined before interaction.",
  },
  string: {
    typeLabel: "string | undefined",
    description: "Stored as the entered string, or undefined when empty.",
  },
  tags: {
    typeLabel: "string[]",
    description: "Stored as an array of tag strings.",
  },
  textarea: {
    typeLabel: "string | undefined",
    description: "Stored as the entered string, or undefined when empty.",
  },
  time: {
    typeLabel: "string | undefined",
    description: "Stored as an HH:mm time string, or undefined when empty.",
  },
  "repeatable-group": {
    typeLabel: "object (columnar)",
    description:
      "Stores one array per child question id; each array has `count` entries (one per repetition).",
  },
};

interface PageProps {
  params: Promise<{ type: string }>;
}

export default async function GalleryDetailPage({ params }: PageProps) {
  const { type } = await params;
  const entry = findGalleryEntry(type);
  if (!entry) notFound();

  const jsonSchema = z.toJSONSchema(entry.zodSchema);

  return (
    <Stack gap="lg" maw={1100}>
      <Stack gap={4}>
        <Group gap="sm" align="center">
          <Title order={2}>{entry.label}</Title>
          <Badge variant="light" color="grape" size="lg">
            {entry.type}
          </Badge>
        </Group>
        <Text c="dimmed">{entry.description}</Text>
        <OutputValueSummary type={entry.type} />
      </Stack>

      <GalleryQuestionWorkbench
        example={entry.example}
        expectedType={entry.type}
      />

      <Paper withBorder p="md" radius="md">
        <Title order={4} mb="sm">
          Schema fields
        </Title>
        <Text size="sm" c="dimmed" mb="xs">
          Generated from the Zod schema for this question type.
        </Text>
        <SchemaTable schema={jsonSchema} questionType={entry.type} />
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
}: {
  schema: unknown;
  questionType: QuestionType;
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
        No field information is available for this schema.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {discriminator ? (
        <DiscriminatorSummary
          property={discriminator[1]}
          required={required.has(DISCRIMINATOR_FIELD)}
        />
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <Table highlightOnHover verticalSpacing="sm">
          <TableThead>
            <TableTr>
              <TableTh>Field</TableTh>
              <TableTh>Type</TableTh>
              <TableTh>Required</TableTh>
              <TableTh>Meaning</TableTh>
              <TableTh>Details</TableTh>
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
                            config
                          </Text>
                        ) : null}
                        <Code>{name}</Code>
                      </Group>
                    </TableTd>
                    <TableTd>{describeType(propertyObject)}</TableTd>
                    <TableTd>
                      <Badge
                        color={isRequired ? "green" : "gray"}
                        variant="light"
                      >
                        {isRequired ? "Yes" : "No"}
                      </Badge>
                    </TableTd>
                    <TableTd>
                      <Text size="sm">
                        {fieldDescription(name, questionType)}
                      </Text>
                    </TableTd>
                    <TableTd>
                      <Text size="sm" c="dimmed">
                        {describeDetails(name, propertyObject)}
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
): string {
  if (fieldName === "config.count" && questionType === "repeatable-group") {
    return "Fixed number of repetitions.";
  }

  const shortName = fieldName.includes(".")
    ? fieldName.slice(fieldName.lastIndexOf(".") + 1)
    : fieldName;

  return (
    FIELD_DESCRIPTIONS[fieldName] ??
    FIELD_DESCRIPTIONS[shortName] ??
    "Additional configuration."
  );
}

function OutputValueSummary({ type }: { type: QuestionType }) {
  const output = OUTPUT_VALUE_TYPES[type];

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
            Output value
          </Badge>
          <Code>{output.typeLabel}</Code>
        </Group>
        <Text size="sm" c="dimmed">
          {output.description}
        </Text>
      </Stack>
    </div>
  );
}

function DiscriminatorSummary({
  property,
  required,
}: {
  property: unknown;
  required: boolean;
}) {
  const propertyObject = asSchemaObject(property);
  const constant =
    propertyObject && "const" in propertyObject
      ? formatValue(propertyObject.const)
      : "Unknown";

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
            Discriminator
          </Badge>
          <Code>{DISCRIMINATOR_FIELD}</Code>
          <Text size="sm" c="dimmed">
            constant
          </Text>
          <Code>{constant}</Code>
          {required ? (
            <Badge color="green" variant="light" size="sm">
              Required
            </Badge>
          ) : null}
        </Group>
        <Text size="sm" c="dimmed">
          {FIELD_DESCRIPTIONS[DISCRIMINATOR_FIELD]}
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

function describeType(schema: JsonSchemaObject | undefined): string {
  if (!schema) return "Unknown";

  if ("const" in schema) {
    return "Fixed value";
  }

  if (Array.isArray(schema.enum)) {
    return "One of";
  }

  const type = normalizeType(schema.type);

  if (type === "array") {
    return `Array of ${describeArrayItemType(schema.items)}`;
  }

  if (type) return titleCase(type);
  if (schema.properties) return "Object";

  return "Any";
}

function describeArrayItemType(items: unknown): string {
  const itemSchema = asSchemaObject(items);
  if (!itemSchema) return "values";

  if (itemSchema.properties) return "objects";

  const type = normalizeType(itemSchema.type);
  if (!type) return "values";

  return `${type}s`;
}

function describeDetails(
  fieldName: string,
  schema: JsonSchemaObject | undefined,
): string {
  if (!schema) return "No additional rules.";

  if (fieldName === "config.questions") {
    return "Array of nested question definitions.";
  }

  const details: string[] = [];

  if ("const" in schema) {
    if (fieldName === DISCRIMINATOR_FIELD) {
      details.push(
        "This value selects this question variant in the JSON union.",
      );
    } else {
      details.push("Must match the constant value.");
    }
  }

  if (Array.isArray(schema.enum)) {
    details.push(`Allowed values: ${schema.enum.map(formatValue).join(", ")}.`);
  }

  const itemDetails = describeArrayItems(schema.items);
  if (itemDetails) {
    details.push(itemDetails);
  }

  return details.join(" ") || "No additional rules.";
}

function describeArrayItems(items: unknown): string | undefined {
  const itemSchema = asSchemaObject(items);
  const itemProperties = asSchemaObject(itemSchema?.properties);
  if (!itemProperties) return undefined;

  const fields = Object.entries(itemProperties).map(([name, property]) => {
    const type = describeType(asSchemaObject(property)).toLowerCase();
    return `${name} (${type})`;
  });

  return `Each item includes ${fields.join(", ")}.`;
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
