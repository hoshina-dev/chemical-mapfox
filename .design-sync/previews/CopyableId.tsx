import { CopyableId } from "@repo/web-ui";

export function Preview() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Plain ID (no link)</div>
        <CopyableId value="exp_2f4a8c91d3e7b05" />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>ID with link</div>
        <CopyableId value="exp_2f4a8c91d3e7b05" href="/experiments/exp_2f4a8c91d3e7b05" />
      </div>
      <div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>xs size</div>
        <CopyableId value="smp_9b1c4d7e2a3f" size="xs" />
      </div>
    </div>
  );
}
