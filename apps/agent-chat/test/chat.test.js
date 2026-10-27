import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/chat.js";

const env = { ANTHROPIC_API_KEY: "k", ACCESS_CODE: "secret" };
const req = (code, messages) =>
  new Request("https://x/api/chat", {
    method: "POST",
    headers: { "x-access-code": code },
    body: JSON.stringify({ messages }),
  });

test("rejects wrong access code", async () => {
  const res = await onRequestPost({ request: req("nope", [{ role: "user", content: "hi" }]), env });
  assert.equal(res.status, 401);
});

test("rejects bad payload", async () => {
  const res = await onRequestPost({ request: req("secret", []), env });
  assert.equal(res.status, 400);
});

test("runs a tool turn then finishes", async () => {
  const replies = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "calculate", input: { expression: "6*7" } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "42" }] },
  ];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(replies.shift()));
  try {
    const res = await onRequestPost({ request: req("secret", [{ role: "user", content: "6*7?" }]), env });
    const text = await res.text();
    assert.match(text, /event: step/);
    assert.match(text, /"output":"42"/);
    assert.match(text, /event: done/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
