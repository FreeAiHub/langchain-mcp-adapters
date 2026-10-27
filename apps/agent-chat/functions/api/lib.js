// Shared helpers for the agent loop: tools, guards and the Anthropic call.

export const MAX_TURNS = 6;
export const MAX_MESSAGES = 30;
export const MAX_CHARS = 8000;

export const TOOLS = [
  {
    name: "get_time",
    description: "Return the current UTC date and time.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "calculate",
    description: "Evaluate a basic arithmetic expression (+ - * / % parentheses).",
    input_schema: {
      type: "object",
      properties: { expression: { type: "string" } },
      required: ["expression"],
    },
  },
  {
    name: "fetch_url",
    description: "Fetch a public https page and return its text (first 6000 chars).",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
];

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.0\.0\.0)/i;

export function safeUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (u.protocol !== "https:") throw new Error("only https is allowed");
  if (PRIVATE_HOST.test(u.hostname)) throw new Error("private hosts are blocked");
  return u;
}

export function calculate(expression) {
  if (!/^[0-9+\-*/().%\s]+$/.test(expression) || expression.length > 200) {
    throw new Error("unsupported expression");
  }
  const result = Function(`"use strict"; return (${expression});`)();
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("not a finite number");
  }
  return String(result);
}

export async function runTool(name, input, fetchImpl = fetch) {
  switch (name) {
    case "get_time":
      return new Date().toISOString();
    case "calculate":
      return calculate(String(input.expression ?? ""));
    case "fetch_url": {
      const res = await fetchImpl(safeUrl(String(input.url ?? "")), {
        headers: { "user-agent": "agent-chat/0.1" },
        redirect: "error",
      });
      const html = await res.text();
      return html
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 6000);
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

export function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return null;
  }
  const clean = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content !== "string" || m.content.length > MAX_CHARS) return null;
    clean.push({ role: m.role, content: m.content });
  }
  return clean[clean.length - 1].role === "user" ? clean : null;
}

export const SYSTEM_PROMPT =
  "You are a helpful autonomous agent. Plan briefly, use tools when they help, " +
  "and be honest about what you did and did not verify. Reply in the user's language.";
