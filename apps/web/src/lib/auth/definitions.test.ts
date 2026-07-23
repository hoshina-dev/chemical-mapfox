import { describe, expect, it } from "vitest";

import {
  createLoginFormSchema,
  createRegisterFormSchema,
  isAdmin,
  roleLabel,
} from "./definitions";

describe("isAdmin", () => {
  it("returns true only for admin role", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("user")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe("roleLabel", () => {
  it("maps roles to nav badge labels", () => {
    expect(roleLabel("admin")).toBe("Lab Staff");
    expect(roleLabel("user")).toBe("Client");
    expect(roleLabel(undefined)).toBe("Client");
  });
});

describe("createLoginFormSchema", () => {
  const messages = {
    emailInvalid: "email-invalid",
    passwordRequired: "password-required",
  };
  const schema = createLoginFormSchema(messages);

  it("accepts a valid email and password", () => {
    expect(
      schema.parse({ email: "user@example.com", password: "secret" }),
    ).toEqual({ email: "user@example.com", password: "secret" });
  });

  it("uses translated messages for invalid email and empty password", () => {
    const result = schema.safeParse({ email: "not-an-email", password: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const byPath = Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    expect(byPath.email).toBe("email-invalid");
    expect(byPath.password).toBe("password-required");
  });
});

describe("createRegisterFormSchema", () => {
  const messages = {
    nameRequired: "name-required",
    emailInvalid: "email-invalid",
    passwordMinLength: "password-min",
    organizationRequired: "org-required",
  };
  const schema = createRegisterFormSchema(messages);
  const orgId = "11111111-1111-4111-8111-111111111111";

  it("accepts a valid registration payload", () => {
    expect(
      schema.parse({
        name: " Casey ",
        email: "casey@example.com",
        password: "password1",
        organizationId: orgId,
      }),
    ).toEqual({
      name: "Casey",
      email: "casey@example.com",
      password: "password1",
      organizationId: orgId,
    });
  });

  it("uses translated messages for each invalid field", () => {
    const result = schema.safeParse({
      name: "",
      email: "bad",
      password: "short",
      organizationId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const byPath = Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    expect(byPath.name).toBe("name-required");
    expect(byPath.email).toBe("email-invalid");
    expect(byPath.password).toBe("password-min");
    expect(byPath.organizationId).toBe("org-required");
  });
});
