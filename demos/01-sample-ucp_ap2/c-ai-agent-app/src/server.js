/**
 * Express HTTP server for the UCP Shopping Agent Demo.
 *
 * Routes:
 *   GET  /            → public/index.html (SPA)
 *   GET  /api/status  → { anthropic: boolean }
 *   POST /api/demo    → runs full shopping flow, returns { ok, steps }
 *   POST /api/chat    → AI agent chat (requires ANTHROPIC_API_KEY)
 *                       body: { message, history? }
 *                       returns: { ok, text, toolCallLog, history }
 */
import express from "express";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createMcpClient, callTool } from "./mcp-client.js";
import { runShoppingFlow } from "./shopping-flow.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 3100;

const SYSTEM_PROMPT = `You are a helpful UCP shopping assistant. Help users discover products, manage carts, and complete purchases using the available MCP shopping tools.

Rules:
- Always include meta: { "ucp-agent": { "profile": "https://demo-agent.example/.well-known/ucp" } } in every tool call.
- For complete_checkout and cancel_checkout, also add a UUID as "idempotency-key" in meta.
- Be concise and friendly. Summarize tool results in natural language.
- Respond in the same language the user writes in (Japanese if Japanese input).
- When a user wants to purchase something, guide them through: search → product details → cart → checkout → complete.`;

const app = express();
app.use(express.json());
app.use(express.static(resolve(__dirname, "../public")));

// ── GET /api/status ────────────────────────────────────────────────────────────

app.get("/api/status", (_req, res) => {
  res.json({ anthropic: !!process.env.ANTHROPIC_API_KEY });
});

// ── POST /api/demo ─────────────────────────────────────────────────────────────

app.post("/api/demo", async (_req, res) => {
  let client;
  try {
    client = await createMcpClient();
    const steps = await runShoppingFlow(client);
    res.json({ ok: true, steps });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (client) await client.close().catch(() => {});
  }
});

// ── POST /api/chat ─────────────────────────────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ ok: false, error: "ANTHROPIC_API_KEY が設定されていません" });
  }

  const { message, history = [] } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ ok: false, error: "message is required" });
  }

  let client;
  try {
    client = await createMcpClient();

    // Convert MCP tools to Anthropic tool format
    const { tools: mcpTools } = await client.listTools();
    const anthropicTools = mcpTools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.inputSchema,
    }));

    const anthropic = new Anthropic();
    const messages = [...history, { role: "user", content: message }];
    const toolCallLog = [];

    // Agentic loop: keep calling Claude until no more tool_use
    let response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools: anthropicTools,
    });

    while (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const { isError, data } = await callTool(client, block.name, block.input);
        toolCallLog.push({ tool: block.name, input: block.input, isError });

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(data),
          is_error: isError,
        });
      }

      messages.push({ role: "user", content: toolResults });

      response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools: anthropicTools,
      });
    }

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    messages.push({ role: "assistant", content: response.content });

    res.json({ ok: true, text, toolCallLog, history: messages });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (client) await client.close().catch(() => {});
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const apiStatus = process.env.ANTHROPIC_API_KEY
    ? "✅ 有効（AIチャット機能が使えます）"
    : "❌ 未設定（AIチャット機能は無効）";
  console.log(`\nUCP Shopping Agent Demo`);
  console.log(`  URL              : http://localhost:${PORT}`);
  console.log(`  ANTHROPIC_API_KEY: ${apiStatus}`);
  console.log(`\nCtrl+C で停止\n`);
});
