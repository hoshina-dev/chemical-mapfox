import { Breadcrumbs } from "@repo/web-ui";

export function Preview() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <Breadcrumbs
        items={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/experiment", label: "Experiments" },
          { label: "EXP-2025-0042" },
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/internal", label: "Lab Staff" },
          { href: "/internal/experiment/listing", label: "Experiments" },
          { label: "Workspace" },
        ]}
      />
    </div>
  );
}
