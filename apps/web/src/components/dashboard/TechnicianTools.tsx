"use client";

import { Card, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

const TECHNICIAN_TOOLS = [
  {
    href: "/internal/experiment/onboarding",
    title: "Experiment onboarding",
    description: "Create and edit experiment templates with the form builder.",
  },
  {
    href: "/internal/docs",
    title: "Component reference",
    description:
      "Every form question type, with live previews and the generated schema.",
  },
];

export function TechnicianTools() {
  return (
    <div>
      <Title order={3} mb="sm">
        Lab technician tools
      </Title>
      <Stack gap="sm">
        {TECHNICIAN_TOOLS.map((tool) => (
          <Card
            key={tool.href}
            component={Link}
            href={tool.href}
            withBorder
            radius="md"
            padding="md"
          >
            <Text fw={600}>{tool.title}</Text>
            <Text size="sm" c="dimmed">
              {tool.description}
            </Text>
          </Card>
        ))}
      </Stack>
    </div>
  );
}
