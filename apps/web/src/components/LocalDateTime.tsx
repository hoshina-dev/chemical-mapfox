"use client";

import { useEffect, useState } from "react";

import { formatDateTime } from "@/lib/ticketing/tickets";

function pad(n: number): string {
  return String(n).padStart(2, "0");
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
  const [local, setLocal] = useState<{ text: string; title: string } | null>(
    null,
  );

  useEffect(() => {
    if (!iso) {
      setLocal(null);
      return;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      setLocal(null);
      return;
    }
    setLocal({
      text: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      title: d.toLocaleString(undefined, { timeZoneName: "short" }),
    });
  }, [iso]);

  return (
    <span title={local?.title}>{local ? local.text : formatDateTime(iso)}</span>
  );
}
