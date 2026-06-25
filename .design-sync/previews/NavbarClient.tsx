import { NavbarClient } from "@repo/web-ui";

export function Preview() {
  return (
    <NavbarClient
      user={{
        userId: "usr_preview01",
        name: "Alex Chen",
        email: "alex.chen@chemlab.org",
        role: "admin",
        organizationId: "org_preview",
      }}
    />
  );
}
