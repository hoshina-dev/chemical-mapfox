"use client";

import { Badge } from "@mantine/core";

import { StatusIcon, statusIconKind } from "@/components/ticketing/StatusIcon";
import { colorsForStatus } from "@/lib/ticketing/statusColors";
import { statusMeta } from "@/lib/ticketing/tickets";

type ChipVariant = "badge" | "pill";

const BADGE_SIZES = {
  xs: 10,
  sm: 12,
  md: 12,
  lg: 14,
} as const;

/**
 * Status label with a lifecycle icon. `badge` uses Mantine Badge; `pill` matches
 * the dense uppercase chips on the staff experiments table.
 */
export function StatusChip({
  status,
  variant = "badge",
  size = "sm",
}: {
  status: string;
  variant?: ChipVariant;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const meta = statusMeta(status);
  const iconKind = statusIconKind(status);
  const iconSize = BADGE_SIZES[size];

  if (variant === "badge") {
    return (
      <Badge
        color={meta.color}
        variant="light"
        size={size === "md" ? "sm" : size}
        radius="sm"
        leftSection={<StatusIcon kind={iconKind} size={iconSize} />}
        styles={{ label: { textTransform: "none" } }}
      >
        {meta.label}
      </Badge>
    );
  }

  const colors = colorsForStatus(meta.color);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px 3px 7px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: ".04em",
        whiteSpace: "nowrap",
        background: colors.bg,
        color: colors.fg,
        lineHeight: 1,
      }}
    >
      <StatusIcon kind={iconKind} size={iconSize} />
      {meta.label}
    </span>
  );
}
