/**
 * Express HTTP server for the UCP Shopping Agent Demo.
 *
 * Routes:
 *   GET  /            → public/index.html (SPA)
 *   GET  /api/status  → { gemini: boolean }
 *   POST /api/demo    → runs full shopping flow, returns { ok, steps }
 *   POST /api/chat    → AI agent chat (requires GOOGLE_AI_STUDIO_API_KEY)
 *                       body: { message, history? }
 *                       returns: { ok, text, toolCallLog, history }
 */
import express from "express";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

/** Strip JSON Schema fields unsupported by Gemini function declarations. */
function cleanSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;
  const { additionalProperties, $schema, ...rest } = schema;
  if (rest.properties) {
    rest.properties = Object.fromEntries(
      Object.entries(rest.properties).map(([k, v]) => [k, cleanSchema(v)]),
    );
  }
  if (rest.items) rest.items = cleanSchema(rest.items);
  return rest;
}

const app = express();
app.use(express.json());
app.use(express.static(resolve(__dirname, "../public")));

// ── GET /api/status ────────────────────────────────────────────────────────────

app.get("/api/status", (_req, res) => {
  res.json({ gemini: !!process.env.GOOGLE_AI_STUDIO_API_KEY });
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
  if (!process.env.GOOGLE_AI_STUDIO_API_KEY) {
    return res.status(503).json({ ok: false, error: "GOOGLE_AI_STUDIO_API_KEY が設定されていません" });
  }

  const { message, history = [] } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ ok: false, error: "message is required" });
  }

  let client;
  try {
    client = await createMcpClient();

    // Convert MCP tools to Gemini function declaration format
    const { tools: mcpTools } = await client.listTools();
    const functionDeclarations = mcpTools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      parameters: cleanSchema(t.inputSchema),
    }));

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations }],
    });

    const chat = model.startChat({ history });
    const toolCallLog = [];

    // Agentic loop: keep calling Gemini until no more function calls
    let response = await chat.sendMessage(message);

    while (true) {
      const parts = response.response.candidates?.[0]?.content?.parts ?? [];
      const fnCalls = parts.filter((p) => p.functionCall);
      if (fnCalls.length === 0) break;

      const fnResponses = [];
      for (const part of fnCalls) {
        const { name, args } = part.functionCall;
        const { isError, data } = await callTool(client, name, args);
        toolCallLog.push({ tool: name, input: args, isError });
        fnResponses.push({ functionResponse: { name, response: data } });
      }

      response = await chat.sendMessage(fnResponses);
    }

    const text = response.response.text();
    const updatedHistory = await chat.getHistory();

    res.json({ ok: true, text, toolCallLog, history: updatedHistory });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (client) await client.close().catch(() => {});
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const apiStatus = process.env.GOOGLE_AI_STUDIO_API_KEY
    ? "✅ 有効（AIチャット機能が使えます）"
    : "❌ 未設定（AIチャット機能は無効）";
  console.log(`\nUCP Shopping Agent Demo`);
  console.log(`  URL                    : http://localhost:${PORT}`);
  console.log(`  GOOGLE_AI_STUDIO_API_KEY: ${apiStatus}`);
  console.log(`\nCtrl+C で停止\n`);
});
