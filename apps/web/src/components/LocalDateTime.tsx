"use client";

import { useEffect, useState } from "react";

import { formatDateTime } from "@/lib/ticketing/tickets";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatLocal(iso: string): { text: string; title: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    text: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    title: d.toLocaleString(undefined, { timeZoneName: "short" }),
  };
}

/**
 * Renders an ISO timestamp in the **viewer's local timezone** as
 * `YYYY-MM-DD HH:mm`. Stored timestamps are UTC.
 *
 * The server has no access to the browser's timezone, so to avoid a hydration
 * mismatch the first render — server and initial client — shows the
 * deterministic UTC value (`formatDateTime`); once mounted we swap in the
 * browser-local formatting. The full localized string (with timezone) is
 * exposed via the `title` tooltip.
 */
export function LocalDateTime({ iso }: { iso: string | null }) {
  // Defer browser-local formatting until after mount so the first render
  // (server + initial client) is the deterministic UTC value and hydration
  // matches; once mounted we derive the viewer's local formatting.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // One-time client-mount flag: it must flip *after* hydration so the first
    // client render still matches the server. This is the intended use of an
    // effect here, so the cascading-render heuristic does not apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const local = mounted && iso ? formatLocal(iso) : null;

  return (
    <span title={local?.title}>{local ? local.text : formatDateTime(iso)}</span>
  );
}
