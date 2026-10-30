/**
 * BACKEND-008: JSON Web Tokens (HS256)
 * Specification: ./task8.md (in this folder)
 * Run the tests: npm run test:backend:8
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface TokenClaims {
  /** The user id ("subject"). */
  sub: string;
  email: string;
}

export interface TokenPayload extends TokenClaims {
  /** Issued at, in seconds since 1970. */
  iat: number;
  /** Expires at, in seconds since 1970. */
  exp: number;
}

// Helpers you can use:
//   Buffer.from(text).toString("base64url")            text -> base64url
//   Buffer.from(part, "base64url").toString()          base64url -> text
//   createHmac("sha256", secret).update(data).digest() HMAC-SHA256 as a Buffer
//   timingSafeEqual(bufferA, bufferB)                   compares equal-length Buffers safely
void createHmac;
void timingSafeEqual;

export function signToken(
  _claims: TokenClaims,
  _secret: string,
  _options: { expiresInSeconds: number; now?: number },
): string {
  throw new Error("Not implemented: signToken");
}

export function verifyToken(_token: string, _secret: string, _now: number = Date.now()): TokenPayload | null {
  throw new Error("Not implemented: verifyToken");
}
