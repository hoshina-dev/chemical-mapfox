import { LinkButton } from "@repo/web-ui";

export function Preview() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <LinkButton href="/experiment/request">Request experiment</LinkButton>
        <LinkButton href="/dashboard" variant="light">Dashboard</LinkButton>
        <LinkButton href="/experiment/request" variant="outline">Outline</LinkButton>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <LinkButton href="/dashboard" size="sm" variant="default">Small default</LinkButton>
        <LinkButton href="/dashboard" size="xs" color="red" variant="light">Danger (xs)</LinkButton>
      </div>
    </div>
  );
}
