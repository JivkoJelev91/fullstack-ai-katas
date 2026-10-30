import type request from "supertest";
import { expect } from "vitest";

/** Describes a response for a failure message. For a 500 it shows the error the app threw. */
export function describeResponse(res: request.Response): string {
  if (res.status === 500) {
    // Express answers an unhandled error with an HTML page whose <pre> holds the error.
    const thrown = /<pre>([\s\S]*?)(<br>|<\/pre>)/.exec(res.text ?? "")?.[1];
    if (thrown) return `Your code threw: ${decodeHtml(thrown).trim()}`;
  }
  return `Response body: ${res.text ? res.text.slice(0, 300) : "(empty)"}`;
}

/** Fails with a message that says which rule was checked and what the app returned. */
export function expectStatus(res: request.Response, status: number, rule: string): void {
  if (res.status !== status) {
    expect.fail(`${rule}\nExpected status ${status}, got ${res.status}.\n${describeResponse(res)}`);
  }
}

/** Checks the error shape every task uses: { "error": "<any text>" }. */
export function expectError(res: request.Response, status: number, rule: string): void {
  expectStatus(res, status, rule);
  if (typeof res.body?.error !== "string") {
    expect.fail(`${rule}\nThe body must be { "error": "<message>" }, got ${res.text || "(empty)"}`);
  }
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
