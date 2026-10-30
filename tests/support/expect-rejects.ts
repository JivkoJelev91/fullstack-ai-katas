import { expect } from "vitest";

/** Awaits the promise, asserts it rejects with an instance of `type`, and returns the error. */
export async function expectRejects<T extends Error>(
  promise: Promise<unknown> | (() => Promise<unknown>),
  type: abstract new (...args: never[]) => T,
): Promise<T> {
  let error: unknown;
  try {
    await (typeof promise === "function" ? promise() : promise);
  } catch (e) {
    error = e;
  }
  expect(error, `expected the call to throw ${type.name}`).toBeDefined();
  expect(
    error,
    `expected ${type.name}, received ${(error as Error)?.constructor?.name}: ${(error as Error)?.message}`,
  ).toBeInstanceOf(type);
  return error as T;
}

/** Asserts that a synchronous call throws an instance of `type` and returns the error. */
export function expectThrows<T extends Error>(fn: () => unknown, type: abstract new (...args: never[]) => T): T {
  let error: unknown;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  expect(error, `expected the call to throw ${type.name}`).toBeDefined();
  expect(
    error,
    `expected ${type.name}, received ${(error as Error)?.constructor?.name}: ${(error as Error)?.message}`,
  ).toBeInstanceOf(type);
  return error as T;
}
