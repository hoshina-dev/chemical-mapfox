"use client";

import {
  ActionIcon,
  Button,
  Card,
  CopyButton,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] ?? c,
  );
}

/**
 * The printable QR label a requester attaches to the box they ship to the lab.
 * The QR encodes the absolute check-in URL (`/internal/experiment/checkin/{id}`)
 * that lab staff scan to receive the sample. "Print label" opens a clean print
 * window with just the QR + ids (no page chrome); the raw URL is copyable too.
 */
export function SampleLabel({
  url,
  title,
  contextId,
}: {
  url: string;
  title: string;
  contextId: string;
}) {
  const qrRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const win = window.open("", "_blank", "width=420,height=620");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Sample label</title>` +
        `<style>` +
        `body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:32px;color:#111}` +
        `h1{font-size:18px;margin:0 0 4px}` +
        `.ctx{font-family:ui-monospace,monospace;font-size:11px;color:#555;word-break:break-all;margin-top:6px}` +
        `.qr{margin:20px auto;display:inline-block}` +
        `.hint{font-size:13px;color:#333;margin:16px auto 0;max-width:320px}` +
        `</style></head><body>` +
        `<h1>${escapeHtml(title)}</h1>` +
        `<div class="ctx">${escapeHtml(contextId)}</div>` +
        `<div class="qr">${svg.outerHTML}</div>` +
        `<div class="hint">Attach this label to the box containing your sample before shipping it to the lab.</div>` +
        `<div class="ctx">${escapeHtml(url)}</div>` +
        `</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <div>
          <Title order={4}>Ship your sample</Title>
          <Text size="sm" c="dimmed">
            Print this QR label and attach it to the box you send to the lab.
            Staff scan it to check your sample in on arrival.
          </Text>
        </div>
        <Group align="flex-start" gap="lg" wrap="wrap">
          <div
            ref={qrRef}
            style={{ background: "white", padding: 8, borderRadius: 8 }}
          >
            <QRCodeSVG value={url} size={180} level="M" />
          </div>
          <Stack gap="sm" style={{ flex: 1, minWidth: 220 }}>
            <Button onClick={handlePrint} variant="light" w="fit-content">
              Print label
            </Button>
            <Text size="xs" c="dimmed">
              Or share this link:
            </Text>
            <Group gap={6} wrap="nowrap" align="center">
              <Text size="xs" ff="monospace" style={{ wordBreak: "break-all" }}>
                {url}
              </Text>
              <CopyButton value={url} timeout={1500}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy"} withArrow>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color={copied ? "teal" : "gray"}
                      aria-label="Copy check-in URL"
                      onClick={copy}
                    >
                      <Text size="xs" aria-hidden>
                        {copied ? "✓" : "⧉"}
                      </Text>
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
          </Stack>
        </Group>
      </Stack>
    </Card>
  );
}
