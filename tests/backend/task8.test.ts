import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "../../src/backend/task8/task8";

const SECRET = "s3cret";
const NOW = 1767225600000; // 2026-01-01T00:00:00Z in milliseconds
const claims = { sub: "u1", email: "ana@example.com" };

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const decode = (part: string | undefined) => JSON.parse(Buffer.from(part ?? "", "base64url").toString());

/** Builds a JWT the standard way, independently of your code. */
function standardToken(header: object, payload: object, secret: string) {
  const data = `${b64(header)}.${b64(payload)}`;
  return `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
}

describe("BACKEND-008", () => {
  describe("signToken", () => {
    it("builds header.payload.signature with the right header and payload", () => {
      const parts = signToken(claims, SECRET, { expiresInSeconds: 3600, now: NOW }).split(".");
      expect(parts.length, "A JWT has 3 parts separated by dots").toBe(3);
      expect(decode(parts[0]), 'The header must be {"alg":"HS256","typ":"JWT"}').toEqual({ alg: "HS256", typ: "JWT" });
      expect(decode(parts[1]), "The payload must hold sub, email, iat and exp (in seconds)").toEqual({
        sub: "u1",
        email: "ana@example.com",
        iat: 1767225600,
        exp: 1767229200,
      });
    });

    it("signs exactly like a standard JWT implementation", () => {
      const token = signToken(claims, SECRET, { expiresInSeconds: 3600, now: NOW });
      const parts = token.split(".");
      const expected = createHmac("sha256", SECRET).update(`${parts[0]}.${parts[1]}`).digest("base64url");
      expect(parts[2], "The signature must be base64url(HMAC-SHA256(secret, header.payload))").toBe(expected);
    });
  });

  describe("verifyToken", () => {
    it("returns the payload of a valid token", () => {
      const token = signToken(claims, SECRET, { expiresInSeconds: 3600, now: NOW });
      expect(verifyToken(token, SECRET, NOW + 1000), "A fresh token signed with the same secret is valid").toEqual({
        ...claims,
        iat: 1767225600,
        exp: 1767229200,
      });
    });

    it("accepts a token built by a standard implementation", () => {
      const token = standardToken({ alg: "HS256", typ: "JWT" }, { sub: "u2", email: "bob@example.com", iat: 1767225600, exp: 1767229200 }, SECRET);
      expect(verifyToken(token, SECRET, NOW)?.sub, "A standard HS256 token must be accepted").toBe("u2");
    });

    it("returns null for another secret", () => {
      const token = signToken(claims, SECRET, { expiresInSeconds: 3600, now: NOW });
      expect(verifyToken(token, "other-secret", NOW), "A token signed with another secret is invalid").toBeNull();
    });

    it("returns null when the payload was changed", () => {
      const [header, , signature] = signToken(claims, SECRET, { expiresInSeconds: 3600, now: NOW }).split(".");
      const forged = `${header}.${b64({ sub: "admin", email: "ana@example.com", iat: 1767225600, exp: 1767229200 })}.${signature}`;
      expect(verifyToken(forged, SECRET, NOW), "A changed payload no longer matches the signature").toBeNull();
    });

    it("returns null for an expired token", () => {
      const token = signToken(claims, SECRET, { expiresInSeconds: 3600, now: NOW });
      expect(verifyToken(token, SECRET, NOW + 3600 * 1000), "At exactly exp the token is expired").toBeNull();
      expect(verifyToken(token, SECRET, NOW + 7200 * 1000), "After exp the token is expired").toBeNull();
    });

    it('returns null for alg "none" and for malformed tokens, without throwing', () => {
      const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "admin", email: "x", iat: 1767225600, exp: 1767229200 })}.`;
      expect(verifyToken(none, SECRET, NOW), 'A token with alg "none" must be rejected').toBeNull();
      for (const bad of ["abc", "a.b", "a.b.c", "..."]) {
        expect(verifyToken(bad, SECRET, NOW), `"${bad}" is not a valid token`).toBeNull();
      }
    });
  });
});
