"use client";

import {
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
  Tooltip,
} from "@mantine/core";
import { useRouter } from "next/navigation";

import { templateBuilderPath } from "@/lib/experiment-manager/routes";
import type { TemplateSummary } from "@/lib/experiment-manager/mappers";

export function SampleTemplatesTable({
  templates,
}: {
  templates: TemplateSummary[];
}) {
  const router = useRouter();

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <TableThead>
        <TableTr>
          <TableTh>Template</TableTh>
          <TableTh>Description</TableTh>
        </TableTr>
      </TableThead>
      <TableTbody>
        {templates.map((tpl) => (
          <Tooltip
            key={tpl.templateId}
            label={`Click to edit "${tpl.title}"`}
            openDelay={700}
            position="top-start"
          >
            <TableTr
              className="bold-row"
              onClick={() => router.push(templateBuilderPath(tpl))}
              style={{ cursor: "pointer" }}
            >
              <TableTd>
                <Text fw={500}>{tpl.title}</Text>
              </TableTd>
              <TableTd>
                <Text size="sm" c="dimmed">
                  {tpl.description ?? "—"}
                </Text>
              </TableTd>
            </TableTr>
          </Tooltip>
        ))}
      </TableTbody>
    </Table>
  );
}
