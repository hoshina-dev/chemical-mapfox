import { hashSync } from "bcryptjs";

/**
 * In-memory fixture store shared between the Cucumber process (where step
 * definitions seed data) and the backend stub server (which reads from it to
 * answer the app's server-side requests). Because both run in the same Node
 * process, seeding is a plain object mutation — no HTTP round-trip needed.
 */

export type CustApiRole = "admin" | "user";

export interface DbUser {
  id: string;
  name: string;
  email: string;
  /** bcrypt hash of the plaintext password. */
  passwordHash: string;
  role: CustApiRole;
  avatarUrl?: string;
  organizationIds: string[];
}

export interface DbOrg {
  id: string;
  name: string;
}

export interface Database {
  users: DbUser[];
  orgs: DbOrg[];
}

export const db: Database = { users: [], orgs: [] };

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A deterministic UUID-shaped id (custapi/zod expect a uuid for organizationId). */
function pseudoUuid(seed: string): string {
  const hex = Buffer.from(seed).toString("hex").padEnd(32, "0").slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/** Reset the store to its baseline (one organization, no users) before each scenario. */
export function resetDb(): void {
  db.users = [];
  db.orgs = [];
  idCounter = 0;
  addOrg("Acme Labs");
}

export function addOrg(name: string): DbOrg {
  const existing = db.orgs.find((o) => o.name === name);
  if (existing) return existing;
  const org: DbOrg = { id: pseudoUuid(`org-${slug(name)}`), name };
  db.orgs.push(org);
  return org;
}

export function findOrgByName(name: string): DbOrg | undefined {
  return db.orgs.find((o) => o.name === name);
}

export function findOrgById(id: string): DbOrg | undefined {
  return db.orgs.find((o) => o.id === id);
}

export interface AddUserInput {
  name: string;
  email: string;
  password: string;
  role?: CustApiRole;
  organization?: string;
}

/** Add (or replace, by email) a user, attaching them to an organization. */
export function addUser(input: AddUserInput): DbUser {
  const org = input.organization ? addOrg(input.organization) : db.orgs[0];
  const user: DbUser = {
    id: nextId("user"),
    name: input.name,
    email: input.email,
    passwordHash: hashSync(input.password, 10),
    role: input.role ?? "user",
    avatarUrl: undefined,
    organizationIds: org ? [org.id] : [],
  };
  const idx = db.users.findIndex((u) => u.email === input.email);
  if (idx >= 0) db.users[idx] = user;
  else db.users.push(user);
  return user;
}

export function findUserByEmail(email: string): DbUser | undefined {
  return db.users.find((u) => u.email === email);
}

export function findUserById(id: string): DbUser | undefined {
  return db.users.find((u) => u.id === id);
}

export function createUserFromRegistration(input: {
  name: string;
  email: string;
  password: string;
}): DbUser {
  const user: DbUser = {
    id: nextId("user"),
    name: input.name,
    email: input.email,
    passwordHash: hashSync(input.password, 10),
    role: "user",
    organizationIds: [],
  };
  db.users.push(user);
  return user;
}

const ISO = new Date("2025-01-01T00:00:00.000Z").toISOString();

/** custapi UserDetailResponse wire shape (snake_case, includes password hash). */
export function userDetailWire(user: DbUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password: user.passwordHash,
    role: user.role,
    avatar_url: user.avatarUrl ?? null,
    research_categories: [],
    created_at: ISO,
    updated_at: ISO,
  };
}

/** custapi UserResponse wire shape (no password). */
export function userWire(user: DbUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar_url: user.avatarUrl ?? null,
    research_categories: [],
    created_at: ISO,
    updated_at: ISO,
  };
}

export function orgWire(org: DbOrg) {
  return {
    id: org.id,
    name: org.name,
    created_at: ISO,
    updated_at: ISO,
  };
}

/** custapi UserMembershipResponse wire shape. */
export function membershipWire(org: DbOrg) {
  return {
    organization_id: org.id,
    organization: orgWire(org),
    role: "member",
    created_at: ISO,
  };
}
