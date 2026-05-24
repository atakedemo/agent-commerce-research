/**
 * Express HTTP server for the UCP Shopping Agent Demo.
 *
 * Routes:
 *   GET  /              → public/index.html (SPA)
 *   GET  /api/status    → { gemini, paymentHandler, trustedSurface, ap2SessionActive }
 *   POST /api/demo      → runs full shopping flow, returns { ok, steps }
 *   POST /api/tokenize  → proxies to Payment Handler /tokenize
 *   POST /api/chat      → UCP AI agent chat (requires GOOGLE_AI_STUDIO_API_KEY)
 *   POST /api/ap2/init  → initializes AP2 HNP session (agent key gen + open mandate)
 *   POST /api/chat-ap2  → AP2 HNP AI agent chat (auto-credential injection)
 */
import express from "express";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createMcpClient, callTool } from "./mcp-client.js";
import { runShoppingFlow } from "./shopping-flow.js";

const __dirname           = dirname(fileURLToPath(import.meta.url));
const PORT                = process.env.PORT                        ?? 3100;
const PAYMENT_HANDLER_URL = process.env.PAYMENT_HANDLER_URL?.replace(/\/$/, "") ?? null;
const TRUSTED_SURFACE_URL = process.env.TRUSTED_SURFACE_URL?.replace(/\/$/, "") ?? null;

// ─── WebCrypto（AP2 エージェント鍵署名用）────────────────────────────────────

const { subtle } = globalThis.crypto;

// ─── AP2 セッション状態（サーバー起動中は in-memory で保持）─────────────────

let _ap2Session = null;
// { agentKeyPair, agentPubJwk, openPaymentMandate, openCheckoutMandate, expiresAt, intent, vpToken }

// DC API セッション管理（nonce→agent keypair の保持）
const _pendingDcSessions = new Map();
// Map<nonce, { keyPair, agentPubJwk, createdAt }>

const INSTRUMENT_MAP = {
  card_visa_4242: { id: "card_visa_4242", type: "card", description: "Visa ···· 4242" },
  card_mc_5555:   { id: "card_mc_5555",   type: "card", description: "Mastercard ···· 5555" },
};

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

/**
 * L3 Closed Mandate (KB-SD-JWT) をエージェント鍵で署名する。
 * typ: "kb-sd-jwt"、kid: agentKid を header に付与する（VI spec §5）。
 */
async function signAp2Jwt(payload) {
  if (!_ap2Session) throw new Error("AP2 session not initialized");
  const header = { alg: "ES256", typ: "kb-sd-jwt", kid: _ap2Session.agentKid };
  const input  = `${b64url(header)}.${b64url(payload)}`;
  const sig    = await subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    _ap2Session.agentKeyPair.privateKey,
    Buffer.from(input),
  );
  return `${input}.${Buffer.from(sig).toString("base64url")}`;
}

/**
 * create_checkout 成功後に自動で Closed Checkout Mandate を生成する。
 * Closed Checkout Mandate は complete_checkout の ap2.checkout_mandate に使用する。
 */
async function createClosedCheckoutMandate(checkoutData) {
  if (!_ap2Session?.openCheckoutMandate) return null;
  try {
    const sdHash  = createHash("sha256").update(_ap2Session.openCheckoutMandate).digest("base64url");
    const payload = {
      iss:          "shopping-agent",
      vct:          "mandate.checkout.1",
      iat:          Math.floor(Date.now() / 1000),
      exp:          Math.floor(Date.now() / 1000) + 300,
      jti:          randomUUID(),
      sd_hash:      sdHash,
      checkout_jwt: checkoutData.checkout_jwt ?? null,
    };
    return signAp2Jwt(payload);
  } catch (e) {
    console.error("[ap2/checkout-mandate] error:", e.message);
    return null;
  }
}

/**
 * create_checkout 成功後に自動で Closed Mandate を作成し Credential Provider に送信する。
 * 成功時は Credential レスポンス（token / expiry / transaction_id）を返す。
 */
async function requestAp2Credential(checkoutData) {
  if (!_ap2Session || !PAYMENT_HANDLER_URL) return null;
  try {
    const intent       = _ap2Session.intent ?? {};
    const instrumentId = intent.payment_instrument_id ?? "card_visa_4242";
    const instrument   = INSTRUMENT_MAP[instrumentId] ?? INSTRUMENT_MAP.card_visa_4242;
    const sdHash       = createHash("sha256").update(_ap2Session.openPaymentMandate).digest("base64url");

    const closedPayload = {
      iss:            "shopping-agent",
      vct:            "mandate.payment.1",
      iat:            Math.floor(Date.now() / 1000),
      exp:            Math.floor(Date.now() / 1000) + 300,
      jti:            randomUUID(),
      sd_hash:        sdHash,
      transaction_id: checkoutData.checkout_hash ?? randomUUID(),
      payment_amount: {
        amount:   intent.amount_range?.max ? Math.min(intent.amount_range.max, 12000) : 12000,
        currency: intent.amount_range?.currency ?? "JPY",
      },
      payee: {
        id:   intent.merchants?.[0]?.id   ?? "merchant_1",
        name: intent.merchants?.[0]?.name ?? "Demo Merchant",
      },
      payment_instrument: instrument,
    };
    const closedMandate = await signAp2Jwt(closedPayload);

    const credRes = await fetch(`${PAYMENT_HANDLER_URL}/credential`, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({
        open_payment_mandate:   _ap2Session.openPaymentMandate,
        closed_payment_mandate: closedMandate,
        checkout_hash:          checkoutData.checkout_hash,
      }),
    });
    if (!credRes.ok) {
      const text = await credRes.text().catch(() => "");
      console.error(`[ap2/credential] CP error ${credRes.status}: ${text}`);
      return null;
    }
    const credData = await credRes.json();
    return { ...credData, _closed_mandate: closedMandate };
  } catch (e) {
    console.error("[ap2/credential] error:", e.message);
    return null;
  }
}

// ─── Gemini ユーティリティ ──────────────────────────────────────────────────

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

const UCP_SYSTEM_PROMPT = `You are a helpful UCP shopping assistant. Help users discover products, manage carts, and complete purchases using the available MCP shopping tools.

Rules:
- Always include meta: { "ucp-agent": { "profile": "https://demo-agent.example/.well-known/ucp" } } in every tool call.
- For complete_checkout and cancel_checkout, also add a UUID as "idempotency-key" in meta.
- Be concise and friendly. Summarize tool results in natural language.
- Respond in the same language the user writes in (Japanese if Japanese input).
- When a user wants to purchase something, guide them through: search → product details → cart → checkout → complete.
- If create_checkout returns payment_handlers, inform the user that credit card information is required. Ask them to use the payment form on the screen to issue a payment token, then include the token in complete_checkout as checkout.payment.instruments[0].credential.token.
- When the user provides a payment token message containing "checkout_id:" and "token:", extract those values and call complete_checkout with id equal to the checkout_id value and checkout.payment.instruments[0].credential.token equal to the token value. Do not use any other checkout_id.`;

const AP2_SYSTEM_PROMPT = `You are a UCP shopping assistant operating in AP2 HNP (Human Not Present) mode.
The user has pre-authorized purchases via the AP2 Trusted Surface. You have authority to complete purchases autonomously within the authorized constraints.

Flow to follow:
1. search_catalog — search for products matching the user's request
2. get_product — get details and variant IDs for the chosen product
3. create_cart — create a cart with the chosen item
4. create_checkout — start a checkout session. IMPORTANT: the response will contain an "ap2_credential" object with a "token" field. This is the payment credential issued automatically by the AP2 Credential Provider.
5. update_checkout — add shipping info (email and shipping_address)
6. complete_checkout — finalize the purchase with the AP2 extension:
   - Set checkout.payment.instruments = [{ type: "card", credential: { token: "<ap2_credential.token from create_checkout response>" } }]
   - Set top-level ap2 = { checkout_mandate: "<ap2_checkout_mandate from create_checkout response>" }
   Both values are automatically injected into the create_checkout response.

Rules:
- Always include meta: { "ucp-agent": { "profile": "https://demo-agent.example/.well-known/ucp" } } in every tool call.
- For complete_checkout and cancel_checkout, also add a random UUID as "idempotency-key" in meta.
- Do NOT ask for credit card information. Payment credentials are issued automatically via AP2.
- Be concise. Summarize what is happening in natural language.
- Respond in the same language the user writes in (Japanese if Japanese input).`;

// ─── Express ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static(resolve(__dirname, "../public")));

// ── 永続 MCP クライアント（UCP チャット用）───────────────────────────────────

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

// ── 永続 MCP クライアント（AP2 チャット用）──────────────────────────────────

let _ap2ChatClient = null;
let _ap2ChatTools  = null;

async function getAp2ChatMcpClient() {
  if (!_ap2ChatClient) {
    _ap2ChatClient = await createMcpClient();
    const { tools } = await _ap2ChatClient.listTools();
    _ap2ChatTools = tools;
  }
  return { client: _ap2ChatClient, tools: _ap2ChatTools };
}

function resetAp2ChatClient() {
  _ap2ChatClient?.close().catch(() => {});
  _ap2ChatClient = null;
  _ap2ChatTools  = null;
}

// ── GET /api/ap2/dc-request ──────────────────────────────────────────────────
//
// Digital Credentials API 用のリクエストパラメータを生成して返す。
//   - dcql_query: DPC credential (com.emvco.dpc) を要求
//   - transaction_data: delegate 型で checkout/payment の Open Mandate 提案を格納
//   - エージェント鍵ペアを nonce に紐付けて保持 → POST /api/ap2/init で引き継ぐ
//
// Query params:
//   max_amount    最大金額 (JPY, 省略時 50000)
//   merchant_id   マーチャント ID (省略時 merchant_1)
//   merchant_name マーチャント名 (省略時 Demo Merchant)

app.get("/api/ap2/dc-request", async (req, res) => {
  try {
    const nonce        = randomUUID();
    const maxAmount    = parseInt(req.query.max_amount   ?? "50000", 10);
    const merchantId   = req.query.merchant_id   ?? "merchant_1";
    const merchantName = req.query.merchant_name ?? "Demo Merchant";
    const exp = Math.floor(Date.now() / 1000) + 3600;

    const agentKid    = randomUUID();
    const keyPair     = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const rawPubJwk   = await subtle.exportKey("jwk", keyPair.publicKey);
    const agentPubJwk = { ...rawPubJwk, kid: agentKid };

    // L2 Autonomous Open Mandate (VI spec §4.2)
    const paymentMandatePayload = {
      vct:            "mandate.payment",
      exp,
      cnf:            { jwk: agentPubJwk },
      payee:          { id: merchantId, name: merchantName },
      payment_amount: { amount: maxAmount, currency: "JPY" },
      constraints: {
        "payment.amount_range":   { max: maxAmount, currency: "JPY" },
        "payment.allowed_payees": [{ id: merchantId, name: merchantName }],
      },
    };

    // L2 Autonomous Open Mandate (VI spec §4.2)
    const checkoutMandatePayload = {
      vct: "mandate.checkout",
      exp,
      cnf: { jwk: agentPubJwk },
      constraints: {
        "checkout.allowed_merchants": [{ id: merchantId, name: merchantName }],
      },
    };

    // delegate 型 transaction_data（CMWallet matcher openid4vp1_0.c 準拠）
    const delegateItem = {
      type:                 "delegate",
      format:               "dc+sd-jwt",
      credential_ids:       ["dpc_credential"],
      delegate_payload:     [paymentMandatePayload, checkoutMandatePayload],
      delegate_disclosures: [],
    };
    const transactionDataEncoded = Buffer.from(JSON.stringify(delegateItem)).toString("base64url");

    _pendingDcSessions.set(nonce, { keyPair, agentPubJwk, agentKid, createdAt: Date.now() });

    // 1時間以上経過したセッションを削除
    for (const [n, s] of _pendingDcSessions) {
      if (Date.now() - s.createdAt > 3_600_000) _pendingDcSessions.delete(n);
    }

    console.log(`[dc-request] nonce=${nonce}`);
    res.json({
      nonce,
      response_mode: "dc_api",
      dcql_query: {
        credentials: [{
          id:     "dpc_credential",
          format: "dc+sd-jwt",
          meta:   { vct_values: ["com.emvco.dpc"] },
          claims: [
            { path: ["card_last_four"] },
            { path: ["card_network_code"] },
            { path: ["credential_id"] },
          ],
        }],
      },
      // transaction_data: [transactionDataEncoded],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/status ──────────────────────────────────────────────────────────

app.get("/api/status", (_req, res) => {
  res.json({
    gemini:          !!process.env.GOOGLE_AI_STUDIO_API_KEY,
    paymentHandler:  !!PAYMENT_HANDLER_URL,
    trustedSurface:  !!TRUSTED_SURFACE_URL,
    ap2SessionActive: !!_ap2Session,
  });
});

// ── POST /api/tokenize ───────────────────────────────────────────────────────

app.post("/api/tokenize", async (req, res) => {
  if (!PAYMENT_HANDLER_URL) {
    return res.status(503).json({ ok: false, error: "PAYMENT_HANDLER_URL が設定されていません" });
  }
  const { checkout_id, amount = 1000, currency = "jpy", payment_method_id = "pm_card_visa" } = req.body ?? {};
  if (!checkout_id) return res.status(400).json({ ok: false, error: "checkout_id が必要です" });

  try {
    const phRes = await fetch(`${PAYMENT_HANDLER_URL}/tokenize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: { payment_method_id }, binding: { checkout_id }, amount, currency }),
    });
    if (!phRes.ok) {
      const detail = await phRes.text().catch(() => "");
      return res.status(502).json({ ok: false, error: `Payment Handler error ${phRes.status}`, detail });
    }
    res.json({ ok: true, ...(await phRes.json()) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/ap2/init ───────────────────────────────────────────────────────

app.post("/api/ap2/init", async (req, res) => {
  if (!TRUSTED_SURFACE_URL) {
    return res.status(503).json({
      ok: false,
      error: "TRUSTED_SURFACE_URL が設定されていません。c-ai-agent-app/.env に TRUSTED_SURFACE_URL=http://localhost:3300 を追加してください。",
    });
  }
  const { intent = {}, vp_token = null, nonce = null } = req.body;
  try {
    // DC API セッションのキーペアを nonce で引き継ぐ（なければ新規生成）
    let keyPair, agentPubJwk, agentKid;
    if (nonce && _pendingDcSessions.has(nonce)) {
      const pendingSession = _pendingDcSessions.get(nonce);
      keyPair     = pendingSession.keyPair;
      agentPubJwk = pendingSession.agentPubJwk;
      agentKid    = pendingSession.agentKid;
      _pendingDcSessions.delete(nonce);
      console.log("[ap2/init] agent keypair inherited from DC session");
    } else {
      agentKid    = randomUUID();
      keyPair     = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const rawPubJwk = await subtle.exportKey("jwk", keyPair.publicKey);
      agentPubJwk = { ...rawPubJwk, kid: agentKid };
    }

    const tsRes = await fetch(`${TRUSTED_SURFACE_URL}/open-mandate`, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ agent_pk: agentPubJwk, intent }),
    });
    if (!tsRes.ok) {
      const text = await tsRes.text().catch(() => "");
      return res.status(502).json({ ok: false, error: `Trusted Surface error ${tsRes.status}: ${text}` });
    }
    const mandate = await tsRes.json();

    _ap2Session = {
      agentKeyPair:        keyPair,
      agentPubJwk,
      agentKid,
      openPaymentMandate:  mandate.open_payment_mandate,
      openCheckoutMandate: mandate.open_checkout_mandate,
      expiresAt:           mandate.expires_at,
      intent,
      vpToken:             vp_token,
    };
    resetAp2ChatClient();

    if (vp_token) console.log(`[ap2/init] vp_token received from DC API wallet`);
    console.log(`[ap2/init] session started, expires=${mandate.expires_at}`);
    res.json({
      ok:                   true,
      expires_at:           mandate.expires_at,
      open_payment_mandate:  mandate.open_payment_mandate  ?? null,
      open_checkout_mandate: mandate.open_checkout_mandate ?? null,
      vp_token_received:     !!vp_token,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/demo ───────────────────────────────────────────────────────────

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

// ── POST /api/chat（UCP フロー）──────────────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  if (!process.env.GOOGLE_AI_STUDIO_API_KEY) {
    return res.status(503).json({ ok: false, error: "GOOGLE_AI_STUDIO_API_KEY が設定されていません" });
  }
  const { message, history = [], buyerProfile = null } = req.body;
  if (!message?.trim()) return res.status(400).json({ ok: false, error: "message is required" });

  try {
    const { client, tools: mcpTools } = await getChatMcpClient();
    const functionDeclarations = mcpTools.map((t) => ({
      name: t.name, description: t.description ?? "", parameters: cleanSchema(t.inputSchema),
    }));

    let systemInstruction = UCP_SYSTEM_PROMPT;
    if (buyerProfile && (buyerProfile.first_name || buyerProfile.email || buyerProfile.address1)) {
      const parts = ["Buyer profile (use this automatically in update_checkout — do not ask the user for this info):"];
      const name = [buyerProfile.first_name, buyerProfile.last_name].filter(Boolean).join(" ");
      if (name)               parts.push(`Name: ${name}`);
      if (buyerProfile.email) parts.push(`Email: ${buyerProfile.email}`);
      if (buyerProfile.phone) parts.push(`Phone: ${buyerProfile.phone}`);
      const addr = {};
      if (buyerProfile.address1) addr.address_1   = buyerProfile.address1;
      if (buyerProfile.address2) addr.address_2   = buyerProfile.address2;
      if (buyerProfile.city)     addr.city         = buyerProfile.city;
      if (buyerProfile.province) addr.province     = buyerProfile.province;
      if (buyerProfile.postal)   addr.postal_code  = buyerProfile.postal;
      if (buyerProfile.country)  addr.country_code = buyerProfile.country.toLowerCase();
      if (Object.keys(addr).length) parts.push(`Shipping address: ${JSON.stringify(addr)}`);
      systemInstruction += `\n\n${parts.join("\n")}`;
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction,
      tools: [{ functionDeclarations }],
    });

    const chat = model.startChat({ history });
    const toolCallLog = [];
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

    res.json({ ok: true, text: response.response.text(), toolCallLog, history: await chat.getHistory() });
  } catch (err) {
    resetChatMcpClient();
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/chat-ap2（AP2 HNP フロー）─────────────────────────────────────

app.post("/api/chat-ap2", async (req, res) => {
  if (!process.env.GOOGLE_AI_STUDIO_API_KEY) {
    return res.status(503).json({ ok: false, error: "GOOGLE_AI_STUDIO_API_KEY が設定されていません" });
  }
  if (!_ap2Session) {
    return res.status(400).json({ ok: false, error: "AP2セッションが初期化されていません。まず「委任を開始」してください。" });
  }
  const { message, history = [], buyerProfile = null } = req.body;
  if (!message?.trim()) return res.status(400).json({ ok: false, error: "message is required" });

  try {
    const { client, tools: mcpTools } = await getAp2ChatMcpClient();
    const functionDeclarations = mcpTools.map((t) => ({
      name: t.name, description: t.description ?? "", parameters: cleanSchema(t.inputSchema),
    }));

    let systemInstruction = AP2_SYSTEM_PROMPT;
    if (buyerProfile && (buyerProfile.first_name || buyerProfile.email || buyerProfile.address1)) {
      const parts = ["Buyer profile (use automatically in update_checkout):"];
      const name = [buyerProfile.first_name, buyerProfile.last_name].filter(Boolean).join(" ");
      if (name)               parts.push(`Name: ${name}`);
      if (buyerProfile.email) parts.push(`Email: ${buyerProfile.email}`);
      if (buyerProfile.phone) parts.push(`Phone: ${buyerProfile.phone}`);
      const addr = {};
      if (buyerProfile.address1) addr.address_1   = buyerProfile.address1;
      if (buyerProfile.address2) addr.address_2   = buyerProfile.address2;
      if (buyerProfile.city)     addr.city         = buyerProfile.city;
      if (buyerProfile.province) addr.province     = buyerProfile.province;
      if (buyerProfile.postal)   addr.postal_code  = buyerProfile.postal;
      if (buyerProfile.country)  addr.country_code = buyerProfile.country.toLowerCase();
      if (Object.keys(addr).length) parts.push(`Shipping address: ${JSON.stringify(addr)}`);
      systemInstruction += `\n\n${parts.join("\n")}`;
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction,
      tools: [{ functionDeclarations }],
    });

    const chat = model.startChat({ history });
    const toolCallLog = [];
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

        // AP2: create_checkout 成功後に自動で Credential と Checkout Mandate を発行してレスポンスに inject する
        if (name === "create_checkout" && !isError && data.checkout_hash) {
          const [cred, checkoutMandate] = await Promise.all([
            requestAp2Credential(data),
            createClosedCheckoutMandate(data),
          ]);

          if (cred?.token) {
            const { _closed_mandate, ...credForAi } = cred;
            data.ap2_credential = credForAi;
            toolCallLog.push({
              tool:    "AP2 /credential（自動発行）",
              input:   { checkout_hash: data.checkout_hash },
              output:  {
                ...credForAi,
                _display: {
                  checkout_jwt:           data.checkout_jwt                ?? null,
                  open_payment_mandate:   _ap2Session?.openPaymentMandate  ?? null,
                  open_checkout_mandate:  _ap2Session?.openCheckoutMandate ?? null,
                  closed_payment_mandate: _closed_mandate                  ?? null,
                },
              },
              isError: false,
            });
          }

          if (checkoutMandate) {
            data.ap2_checkout_mandate = checkoutMandate;
            toolCallLog.push({
              tool:    "AP2 Checkout Mandate（自動生成）",
              input:   { checkout_id: data.id, checkout_hash: data.checkout_hash },
              output:  { ap2_checkout_mandate: checkoutMandate.substring(0, 60) + "…" },
              isError: false,
            });
          }
        }

        fnResponses.push({ functionResponse: { name, response: data } });
      }
      response = await chat.sendMessage(fnResponses);
    }

    res.json({ ok: true, text: response.response.text(), toolCallLog, history: await chat.getHistory() });
  } catch (err) {
    resetAp2ChatClient();
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const geminiStatus = process.env.GOOGLE_AI_STUDIO_API_KEY ? "✅ 有効" : "❌ 未設定";
  const phStatus     = PAYMENT_HANDLER_URL  ? `✅ 有効（${PAYMENT_HANDLER_URL}）`  : "❌ 未設定";
  const tsStatus     = TRUSTED_SURFACE_URL  ? `✅ 有効（${TRUSTED_SURFACE_URL}）`  : "❌ 未設定（AP2 HNP 不可）";
  console.log(`\nUCP Shopping Agent Demo`);
  console.log(`  URL                    : http://localhost:${PORT}`);
  console.log(`  GOOGLE_AI_STUDIO_API_KEY: ${geminiStatus}`);
  console.log(`  PAYMENT_HANDLER_URL    : ${phStatus}`);
  console.log(`  TRUSTED_SURFACE_URL    : ${tsStatus}`);
  console.log(`\nCtrl+C で停止\n`);
});
