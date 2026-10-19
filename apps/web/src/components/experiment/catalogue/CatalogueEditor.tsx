"use client";

import { Accessibility } from "@dnd-kit/dom";
import {
  DragDropProvider,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/react";
import { isSortableOperation, useSortable } from "@dnd-kit/react/sortable";
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
} from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import {
  setCatalogueOrderAction,
  setCatalogueVisibilityAction,
  type ActionResult,
} from "@/app/actions/experiment-manager";

export interface CatalogueItem {
  id: string;
  name: string;
  description?: string;
  href: string;
  visible: boolean;
  count?: number | null;
  hasPdfTemplate?: boolean;
}

export function CatalogueEditor({
  items: initial,
  sampleId,
  variant = "cards",
}: {
  items: CatalogueItem[];
  sampleId?: string;
  variant?: "cards" | "table";
}) {
  const t = useTranslations("staff.catalogue");
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<{
    source: CatalogueItem[];
    items: CatalogueItem[];
  } | null>(null);
  const items = draft?.source === initial ? draft.items : initial;
  const setItems = (next: CatalogueItem[]) =>
    setDraft({ source: initial, items: next });
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function save(
    next: CatalogueItem[],
    action: () => Promise<ActionResult<null>>,
  ) {
    if (busy.current) return;
    busy.current = true;
    const previous = items;
    setPending(true);
    setError(null);
    setStatus(t("saving"));
    setItems(next);
    try {
      const result = await action();
      if (!result.success) throw new Error(result.error);
      setStatus(t("saved"));
    } catch {
      setItems(previous);
      setError(t("saveError"));
      setStatus("");
    } finally {
      busy.current = false;
      setPending(false);
      router.refresh();
    }
  }

  function move(id: string, position: number) {
    if (
      busy.current ||
      !Number.isInteger(position) ||
      position < 1 ||
      position > items.length
    )
      return;
    const index = items.findIndex((item) => item.id === id);
    if (index < 0 || index === position - 1) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(position - 1, 0, item);
    void save(next, () =>
      setCatalogueOrderAction(
        next.map((row) => row.id),
        sampleId,
      ),
    );
  }

  function toggle(id: string, visible: boolean) {
    const current = items.find((item) => item.id === id);
    if (!current || current.visible === visible) return;
    void save(
      items.map((item) => (item.id === id ? { ...item, visible } : item)),
      () => setCatalogueVisibilityAction(id, visible, sampleId),
    );
  }

  function dragEnd(event: DragEndEvent) {
    if (event.canceled || !isSortableOperation(event.operation)) return;
    const { source } = event.operation;
    if (source) move(String(source.id), source.index + 1);
  }

  const accessibility = useMemo(() => {
    const name = (id: unknown) =>
      items.find((item) => item.id === String(id))?.name ?? "";
    return Accessibility.configure({
      screenReaderInstructions: { draggable: t("keyboardInstructions") },
      announcements: {
        dragstart: (event: DragStartEvent) =>
          t("dragStart", { name: name(event.operation.source?.id) }),
        dragover: (event: DragOverEvent) =>
          isSortableOperation(event.operation) && event.operation.source
            ? t("dragPosition", {
                name: name(event.operation.source.id),
                position: event.operation.source.index + 1,
              })
            : undefined,
        dragend: (event: DragEndEvent) =>
          event.canceled ? t("dragCancelled") : t("dragFinished"),
      },
    });
  }, [items, t]);

  const rows = items.map((item, index) => (
    <CatalogueRow
      key={item.id}
      item={item}
      index={index}
      variant={variant}
      pending={pending}
      toggle={toggle}
    />
  ));

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        {t("help")}
      </Text>
      {error && (
        <Alert color="red" title={t("saveFailed")}>
          {error}
        </Alert>
      )}
      <Text size="sm" c="dimmed" role="status" aria-live="polite">
        {status}
      </Text>
      <DragDropProvider
        key={locale}
        onDragEnd={dragEnd}
        plugins={(defaults) =>
          defaults.map((plugin) =>
            plugin === Accessibility ? accessibility : plugin,
          )
        }
      >
        {variant === "cards" ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {rows}
          </SimpleGrid>
        ) : (
          <Table.ScrollContainer
            minWidth={700}
            role="region"
            aria-label={t("experiment")}
            tabIndex={0}
          >
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th aria-label={t("reorder")} />
                  <Table.Th>{t("experiment")}</Table.Th>
                  <Table.Th>{t("description")}</Table.Th>
                  <Table.Th>{t("visibility")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </DragDropProvider>
    </Stack>
  );
}

function CatalogueRow({
  item,
  index,
  variant,
  pending,
  toggle,
}: {
  item: CatalogueItem;
  index: number;
  variant: "cards" | "table";
  pending: boolean;
  toggle: (id: string, visible: boolean) => void;
}) {
  const t = useTranslations("staff.catalogue");
  const { ref, handleRef, isDragging } = useSortable({
    id: item.id,
    index,
    disabled: pending,
  });
  const handle = (
    <ActionIcon
      ref={handleRef}
      aria-label={t("dragHandle", { name: item.name })}
      disabled={pending}
      variant="subtle"
      color="gray"
      style={{ cursor: "grab", touchAction: "none" }}
    >
      <IconGripVertical size={18} aria-hidden />
    </ActionIcon>
  );
  const visibility = (
    <Switch
      checked={item.visible}
      onChange={(event) => toggle(item.id, event.currentTarget.checked)}
      disabled={pending}
      aria-label={t("visibilityFor", { name: item.name })}
      label={variant === "cards" ? t("visibility") : undefined}
    />
  );
  const title = (
    <Group gap="xs">
      <Anchor component={Link} href={item.href} fw={600} c="green.8">
        {item.name}
      </Anchor>
      {item.hasPdfTemplate === false && (
        <Badge color="yellow" variant="light" size="sm">
          {t("noReportLayout")}
        </Badge>
      )}
    </Group>
  );
  if (variant === "table")
    return (
      <Table.Tr ref={ref} style={{ opacity: isDragging ? 0.6 : 1 }}>
        <Table.Td>{handle}</Table.Td>
        <Table.Td>{title}</Table.Td>
        <Table.Td>
          <Text size="sm" c="dimmed">
            {item.description ?? t("noDescription")}
          </Text>
        </Table.Td>
        <Table.Td>{visibility}</Table.Td>
      </Table.Tr>
    );
  return (
    <Card
      ref={ref}
      withBorder
      radius="md"
      padding="lg"
      className="bold-card"
      style={{ opacity: isDragging ? 0.6 : 1 }}
    >
      <Stack gap="sm" h="100%">
        <Group justify="space-between" wrap="nowrap">
          {title}
          {handle}
        </Group>
        <Text size="sm" c="dimmed" lineClamp={2}>
          {item.description ?? t("noDescription")}
        </Text>
        <Text size="sm">
          {item.count == null
            ? t("countUnavailable")
            : t("templateCount", { count: item.count })}
        </Text>
        {visibility}
        <Anchor component={Link} href={item.href} c="green.8" size="sm">
          {t("manageTemplates")}
        </Anchor>
      </Stack>
    </Card>
  );
}
