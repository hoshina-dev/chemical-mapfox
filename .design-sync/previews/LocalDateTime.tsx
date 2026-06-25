import { LocalDateTime } from "@repo/web-ui";

export function Preview() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, fontFamily: "system-ui" }}>
      <small style={{ color: "#888" }}>UTC timestamp in viewer&apos;s local timezone:</small>
      <LocalDateTime iso="2025-03-15T14:30:00.000Z" />
      <small style={{ color: "#888" }}>Null value (no date set):</small>
      <LocalDateTime iso={null} />
    </div>
  );
}
