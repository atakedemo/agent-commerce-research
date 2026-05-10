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
const PAYMENT_HANDLER_URL = process.env.PAYMENT_HANDLER_URL?.replace(/\/$/, "") ?? null;

const SYSTEM_PROMPT = `You are a helpful UCP shopping assistant. Help users discover products, manage carts, and complete purchases using the available MCP shopping tools.

Rules:
- Always include meta: { "ucp-agent": { "profile": "https://demo-agent.example/.well-known/ucp" } } in every tool call.
- For complete_checkout and cancel_checkout, also add a UUID as "idempotency-key" in meta.
- Be concise and friendly. Summarize tool results in natural language.
- Respond in the same language the user writes in (Japanese if Japanese input).
- When a user wants to purchase something, guide them through: search → product details → cart → checkout → complete.
- If create_checkout returns payment_handlers, inform the user that credit card information is required. Ask them to use the payment form on the screen to issue a payment token, then include the token in complete_checkout as checkout.payment.instruments[0].credential.token.`;

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

// ── 永続 MCP クライアント（チャット用） ────────────────────────────────────────
// /api/chat リクエスト間で b-mcp-server プロセスを使い回すことで、
// checkouts / carts の in-memory 状態をセッション中に保持する。

let _chatClient = null;
let _chatTools  = null;

async function getChatMcpClient() {
  if (!_chatClient) {
    _chatClient = await createMcpClient();
    const { tools } = await _chatClient.listTools();
    _chatTools = tools;
  }
  return { client: _chatClient, tools: _chatTools };
}

function resetChatMcpClient() {
  _chatClient?.close().catch(() => {});
  _chatClient = null;
  _chatTools  = null;
}

// ── GET /api/status ────────────────────────────────────────────────────────────

app.get("/api/status", (_req, res) => {
  res.json({
    gemini: !!process.env.GOOGLE_AI_STUDIO_API_KEY,
    paymentHandler: !!PAYMENT_HANDLER_URL,
  });
});

// ── POST /api/tokenize ─────────────────────────────────────────────────────────
// Payment Handler への決済トークン発行リクエストをプロキシする。
// フロントエンドからカード情報を受け取り（デモではモック認証情報を使用）、
// Payment Handler の /tokenize を呼び出してトークンを返す。

app.post("/api/tokenize", async (req, res) => {
  if (!PAYMENT_HANDLER_URL) {
    return res.status(503).json({ ok: false, error: "PAYMENT_HANDLER_URL が設定されていません" });
  }

  const {
    checkout_id,
    amount = 1000,
    currency = "jpy",
    payment_method_id = "pm_card_visa",
  } = req.body ?? {};

  if (!checkout_id) {
    return res.status(400).json({ ok: false, error: "checkout_id が必要です" });
  }

  try {
    const phRes = await fetch(`${PAYMENT_HANDLER_URL}/tokenize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        credential: { payment_method_id },
        binding: { checkout_id },
        amount,
        currency,
      }),
    });

    if (!phRes.ok) {
      const detail = await phRes.text().catch(() => "");
      return res.status(502).json({ ok: false, error: `Payment Handler error ${phRes.status}`, detail });
    }

    const data = await phRes.json();
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
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

  try {
    // 永続クライアントを取得（初回のみ b-mcp-server を起動、以降は使い回す）
    const { client, tools: mcpTools } = await getChatMcpClient();

    // Convert MCP tools to Gemini function declaration format
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
        toolCallLog.push({ tool: name, input: args, output: data, isError });
        fnResponses.push({ functionResponse: { name, response: data } });
      }

      response = await chat.sendMessage(fnResponses);
    }

    const text = response.response.text();
    const updatedHistory = await chat.getHistory();

    res.json({ ok: true, text, toolCallLog, history: updatedHistory });
  } catch (err) {
    // 接続エラー時はクライアントをリセットして次回リクエストで再接続させる
    resetChatMcpClient();
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const geminiStatus = process.env.GOOGLE_AI_STUDIO_API_KEY
    ? "✅ 有効（AIチャット機能が使えます）"
    : "❌ 未設定（AIチャット機能は無効）";
  const phStatus = PAYMENT_HANDLER_URL
    ? `✅ 有効（${PAYMENT_HANDLER_URL}）`
    : "❌ 未設定（決済トークン発行は無効）";
  console.log(`\nUCP Shopping Agent Demo`);
  console.log(`  URL                    : http://localhost:${PORT}`);
  console.log(`  GOOGLE_AI_STUDIO_API_KEY: ${geminiStatus}`);
  console.log(`  PAYMENT_HANDLER_URL    : ${phStatus}`);
  console.log(`\nCtrl+C で停止\n`);
});
