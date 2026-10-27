import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, safeUrl, sameSecret, validateMessages } from "../functions/api/lib.js";

test("calculate evaluates arithmetic", () => {
  assert.equal(calculate("2 + 2 * 3"), "8");
  assert.equal(calculate("(10 - 4) / 3"), "2");
});

test("calculate rejects code", () => {
  assert.throws(() => calculate("process.exit()"));
  assert.throws(() => calculate("1/0"));
});

test("safeUrl blocks non-https and private hosts", () => {
  assert.throws(() => safeUrl("http://example.com"));
  assert.throws(() => safeUrl("https://localhost/x"));
  assert.throws(() => safeUrl("https://192.168.1.1/"));
  assert.throws(() => safeUrl("https://169.254.169.254/latest"));
  assert.equal(safeUrl("https://example.com/a").hostname, "example.com");
});

test("sameSecret compares safely", () => {
  assert.equal(sameSecret("abc", "abc"), true);
  assert.equal(sameSecret("abc", "abd"), false);
  assert.equal(sameSecret("", ""), false);
  assert.equal(sameSecret(null, "x"), false);
});

test("validateMessages enforces shape and ends with user", () => {
  assert.ok(validateMessages([{ role: "user", content: "hi" }]));
  assert.equal(validateMessages([]), null);
  assert.equal(validateMessages([{ role: "assistant", content: "hi" }]), null);
  assert.equal(validateMessages([{ role: "system", content: "x" }]), null);
  assert.equal(validateMessages([{ role: "user", content: "x".repeat(9000) }]), null);
});
