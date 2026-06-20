import {
  Alert,
  Container,
  Group,
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

import { LinkAnchor, LinkButton } from "@/components/links";
import {
  listExperimentTemplates,
  listSamples,
} from "@/lib/experiment-manager/client";
import {
  type TemplateSummary,
  toTemplateSummary,
} from "@/lib/experiment-manager/mappers";
import {
  newTemplatePath,
  templateBuilderPath,
} from "@/lib/experiment-manager/routes";

export const dynamic = "force-dynamic";

interface SampleGroup {
  sampleId: string;
  sampleName: string;
  templates: TemplateSummary[];
}

async function loadGroups(): Promise<SampleGroup[]> {
  const { samples } = await listSamples();
  return Promise.all(
    samples.map(async (sample) => {
      const { experiments } = await listExperimentTemplates(sample.id);
      return {
        sampleId: sample.id,
        sampleName: sample.name,
        templates: experiments.map((row) => toTemplateSummary(sample.id, row)),
      };
    }),
  );
}

export default async function OnboardingPage() {
  let groups: SampleGroup[] | null = null;
  let loadError: string | null = null;
  try {
    groups = await loadGroups();
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Failed to load templates.";
  }

  const totalTemplates =
    groups?.reduce((sum, g) => sum + g.templates.length, 0) ?? 0;

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end">
          <Stack gap={4}>
            <Title order={2}>Experiment onboarding</Title>
            <Text c="dimmed">
              All experiment templates across every sample. Edit one or onboard
              a new experiment template.
            </Text>
          </Stack>
          <LinkButton href={newTemplatePath()}>New template</LinkButton>
        </Group>

        {loadError && (
          <Alert
            color="red"
            variant="light"
            title="Could not reach Experiment Manager"
          >
            {loadError}
          </Alert>
        )}

        {groups && totalTemplates === 0 && !loadError && (
          <Text c="dimmed">No templates yet. Create your first one.</Text>
        )}

        {groups && totalTemplates > 0 && (
          <Table highlightOnHover verticalSpacing="sm">
            <TableThead>
              <TableTr>
                <TableTh>Sample</TableTh>
                <TableTh>Template</TableTh>
                <TableTh>Description</TableTh>
                <TableTh />
              </TableTr>
            </TableThead>
            <TableTbody>
              {groups.flatMap((group) =>
                group.templates.map((tpl) => (
                  <TableTr key={`${group.sampleId}/${tpl.templateId}`}>
                    <TableTd>{group.sampleName}</TableTd>
                    <TableTd>
                      <LinkAnchor href={templateBuilderPath(tpl)} fw={500}>
                        {tpl.title}
                      </LinkAnchor>
                    </TableTd>
                    <TableTd>
                      <Text size="sm" c="dimmed">
                        {tpl.description ?? "—"}
                      </Text>
                    </TableTd>
                    <TableTd align="right">
                      <LinkButton
                        href={templateBuilderPath(tpl)}
                        size="xs"
                        variant="light"
                      >
                        Edit
                      </LinkButton>
                    </TableTd>
                  </TableTr>
                )),
              )}
            </TableTbody>
          </Table>
        )}
      </Stack>
    </Container>
  );
}
