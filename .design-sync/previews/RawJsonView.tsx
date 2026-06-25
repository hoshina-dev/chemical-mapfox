import { RawJsonView } from "@repo/web-ui";

const sampleData = {
  id: "exp_2f4a8c91d3e7b05",
  status: "in_progress",
  title: "Protein Stability Assay",
  submittedAt: "2025-03-15T14:30:00.000Z",
  parameters: { temperature: 37, duration: 24, bufferPh: 7.4, replicates: 3 },
  samples: ["smp_9b1c4d", "smp_7e2a3f", "smp_1c8d9e"],
};

export function Preview() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <RawJsonView data={sampleData} />
      <div>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Undefined (empty state):</div>
        <RawJsonView data={undefined} />
      </div>
    </div>
  );
}
