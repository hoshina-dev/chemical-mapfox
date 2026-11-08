import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isValidCodeChallenge, verifyPkce } from "./pkce";

function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

describe("isValidCodeChallenge", () => {
  it("accepts a 43-character base64url challenge", () => {
    expect(isValidCodeChallenge("a".repeat(43))).toBe(true);
    expect(
      isValidCodeChallenge("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abcde"),
    ).toBe(true);
  });

  it("rejects the wrong length or characters outside base64url", () => {
    expect(isValidCodeChallenge("a".repeat(42))).toBe(false);
    expect(isValidCodeChallenge("a".repeat(44))).toBe(false);
    expect(isValidCodeChallenge(`${"a".repeat(42)}.`)).toBe(false);
    expect(isValidCodeChallenge(`${"a".repeat(42)}~`)).toBe(false);
    expect(isValidCodeChallenge(`${"a".repeat(42)}+`)).toBe(false);
    expect(isValidCodeChallenge("")).toBe(false);
  });
});

describe("verifyPkce", () => {
  it("accepts an S256 verifier in the RFC 7636 length range", () => {
    const min = "a".repeat(43);
    const max = "b".repeat(128);
    expect(verifyPkce(min, challengeFor(min))).toBe(true);
    expect(verifyPkce(max, challengeFor(max))).toBe(true);
  });

  it("rejects a verifier outside the unreserved 43–128 character set", () => {
    const challenge = challengeFor("a".repeat(43));
    expect(verifyPkce("a".repeat(42), challenge)).toBe(false);
    expect(verifyPkce("a".repeat(129), challenge)).toBe(false);
    expect(verifyPkce(`${"a".repeat(42)}+`, challenge)).toBe(false);
    expect(verifyPkce(`${"a".repeat(42)}/`, challenge)).toBe(false);
    expect(verifyPkce(`${"a".repeat(42)} `, challenge)).toBe(false);
    expect(verifyPkce("", challenge)).toBe(false);
  });

  it("rejects a well-formed verifier whose S256 challenge does not match", () => {
    const verifier = "c".repeat(43);
    expect(verifyPkce(verifier, "d".repeat(43))).toBe(false);
  });

  it("rejects a length mismatch without treating it as equal", () => {
    const verifier = "e".repeat(43);
    expect(verifyPkce(verifier, "")).toBe(false);
    expect(verifyPkce(verifier, "f".repeat(42))).toBe(false);
    expect(verifyPkce(verifier, challengeFor(verifier) + "x")).toBe(false);
  });
});
