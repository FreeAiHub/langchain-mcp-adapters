# agent-chat

Manus-style agent chat on Cloudflare Pages (`*.pages.dev`), powered by Claude.
The agent runs a tool loop server-side and streams every step (tool call, result, answer) to the UI.

- `functions/api/chat.js` — Pages Function: auth, validation, agent loop, SSE stream
- `functions/api/lib.js` — tools (`get_time`, `calculate`, `fetch_url`) and guards
- `public/index.html` — chat UI with an action timeline

## Safety
- Access code required (`x-access-code`), so a public URL cannot burn the API budget.
- Max 6 agent turns and 1500 output tokens per turn; message count and size capped.
- `fetch_url`: https only, private/link-local hosts blocked, redirects refused, output truncated.
- `calculate` accepts digits and operators only.

## Run locally
```bash
cd apps/agent-chat
npm install
printf 'ANTHROPIC_API_KEY=...\nACCESS_CODE=choose-a-code\n' > .dev.vars   # never commit
npm run dev
npm test
```

## Deploy to Cloudflare Pages
```bash
npx wrangler login            # or set CLOUDFLARE_API_TOKEN
npx wrangler pages project create agent-chat --production-branch main
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name agent-chat
npx wrangler pages secret put ACCESS_CODE --project-name agent-chat
npm run deploy                # -> https://agent-chat.pages.dev
```
Optional: set `MODEL` (default `claude-sonnet-5-5`).

## Roadmap
1. MCP bridge: connect remote MCP servers as tools (this fork's Python adapters in a sidecar service).
2. Persistent sessions and per-user rate limits (Durable Objects / KV).
3. File and browser tools in a sandbox.

Fork of [langchain-ai/langchain-mcp-adapters](https://github.com/langchain-ai/langchain-mcp-adapters) (MIT, upstream no longer maintained). `apps/agent-chat` is new code and does not yet import the Python library.
