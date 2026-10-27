import {
  MAX_TURNS,
  SYSTEM_PROMPT,
  TOOLS,
  runTool,
  sameSecret,
  validateMessages,
} from "./lib.js";

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY || !env.ACCESS_CODE) {
    return new Response("Server is not configured", { status: 500 });
  }
  if (!sameSecret(request.headers.get("x-access-code"), env.ACCESS_CODE)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const history = validateMessages(body?.messages);
  if (!history) return new Response("Bad request", { status: 400 });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (event, data) => writer.write(enc.encode(sse(event, data)));

  const run = async () => {
    const messages = [...history];
    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: env.MODEL || "claude-sonnet-5-5",
            max_tokens: 1500,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages,
          }),
        });
        if (!res.ok) {
          await send("error", { message: `LLM error ${res.status}` });
          return;
        }
        const msg = await res.json();
        messages.push({ role: "assistant", content: msg.content });
        const results = [];
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            await send("text", { text: block.text });
          } else if (block.type === "tool_use") {
            await send("step", { id: block.id, name: block.name, input: block.input });
            let output;
            let isError = false;
            try {
              output = await runTool(block.name, block.input);
            } catch (e) {
              output = e instanceof Error ? e.message : "tool failed";
              isError = true;
            }
            await send("result", { id: block.id, output: output.slice(0, 500), isError });
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: output,
              is_error: isError,
            });
          }
        }
        if (msg.stop_reason !== "tool_use" || results.length === 0) break;
        messages.push({ role: "user", content: results });
      }
      await send("done", {});
    } catch {
      await send("error", { message: "Internal error" });
    } finally {
      await writer.close();
    }
  };
  // Keep the worker alive until the stream finishes.
  run();

  return new Response(readable, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-store" },
  });
}
