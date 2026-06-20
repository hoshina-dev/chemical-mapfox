"use client";

import {
  Badge,
  Card,
  Group,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { FormRenderer } from "@repo/forms";

import type { ExperimentState } from "@/lib/experiment-manager/mappers";

function formatResult(result: unknown): string {
  if (result === undefined || result === null || result === "") return "—";
  if (typeof result === "object") return JSON.stringify(result);
  return String(result);
}

export function ExperimentStateView({ state }: { state: ExperimentState }) {
  const { template } = state;
  const calculations = Object.entries(template.calculations);
  const hasClientForm = template.clientForm.questions.length > 0;

  return (
    <Stack gap="lg">
      {!state.valid && (
        <Text size="sm" c="orange">
          The stored forms didn&apos;t fully match the current form schema; the
          view below is best-effort.
        </Text>
      )}

      <Tabs defaultValue="lab">
        <Tabs.List>
          <Tabs.Tab value="lab">Lab form</Tabs.Tab>
          {hasClientForm && <Tabs.Tab value="client">Client intake</Tabs.Tab>}
          {calculations.length > 0 && (
            <Tabs.Tab value="calculations">
              Calculations
              <Badge ml="xs" size="xs" variant="light" circle>
                {calculations.length}
              </Badge>
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="lab" pt="lg">
          <Card withBorder radius="md" padding="lg">
            <FormRenderer
              doc={template.labForm}
              initialValues={state.values}
              readOnly
            />
          </Card>
        </Tabs.Panel>

        {hasClientForm && (
          <Tabs.Panel value="client" pt="lg">
            <Card withBorder radius="md" padding="lg">
              <FormRenderer
                doc={template.clientForm}
                initialValues={state.values}
                readOnly
              />
            </Card>
          </Tabs.Panel>
        )}

        {calculations.length > 0 && (
          <Tabs.Panel value="calculations" pt="lg">
            <Card withBorder radius="md" padding="lg">
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>Calculations</Title>
                  <Text size="xs" c="dimmed">
                    Computed from the entered values
                  </Text>
                </Group>
                <Table verticalSpacing="xs" horizontalSpacing="md">
                  <TableThead>
                    <TableTr>
                      <TableTh>Name</TableTh>
                      <TableTh>Formula</TableTh>
                      <TableTh>Result</TableTh>
                    </TableTr>
                  </TableThead>
                  <TableTbody>
                    {calculations.map(([name, calc]) => (
                      <TableTr key={name}>
                        <TableTd>
                          <Text size="sm" fw={500} ff="monospace">
                            {name}
                          </Text>
                        </TableTd>
                        <TableTd>
                          <Text size="sm" c="dimmed" ff="monospace">
                            {calc.formula}
                          </Text>
                        </TableTd>
                        <TableTd>
                          <Text size="sm" fw={500}>
                            {formatResult(calc.result)}
                          </Text>
                        </TableTd>
                      </TableTr>
                    ))}
                  </TableTbody>
                </Table>
              </Stack>
            </Card>
          </Tabs.Panel>
        )}
      </Tabs>
    </Stack>
  );
}
