#!/usr/bin/env node
/**
 * UCP Payment Handler — Stripe tokenizer
 *
 * Implements the UCP Tokenization API:
 *   POST /tokenize    — Stripe PaymentIntent を作成してトークンを返す
 *   POST /detokenize  — トークンを検証し PaymentIntent 情報を返す（単回使用）
 *   GET  /health      — 死活確認
 *
 * Environment:
 *   STRIPE_SECRET_KEY      Stripe シークレットキー（未設定時はモックモード）
 *   PAYMENT_HANDLER_PORT   HTTP ポート（デフォルト: 3200）
 *
 * モックモード（STRIPE_SECRET_KEY 未設定時）:
 *   Stripe API を呼ばず、擬似 token / PaymentIntent ID を返す。
 *   b-mcp-server 側の動作確認に利用できる。
 */

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? null;
const PORT = parseInt(process.env.PAYMENT_HANDLER_PORT ?? "3200", 10);
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 分

// token → { paymentIntentId, checkoutId, expiresAt, isMock }
const tokenStore = new Map();

// ─── Stripe（オプション） ────────────────────────────────────────────────────────

let stripe = null;
if (STRIPE_SECRET_KEY) {
  const { default: Stripe } = await import("stripe");
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

// ─── ユーティリティ ─────────────────────────────────────────────────────────────

function generateToken() {
  return `ucp_tok_${randomBytes(16).toString("hex")}`;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

// ─── ハンドラ ──────────────────────────────────────────────────────────────────

/**
 * POST /tokenize
 *
 * 入力:
 *   credential.payment_method_id — Stripe PaymentMethod ID（テスト時: "pm_card_visa" 等）
 *   binding.checkout_id          — バインド先のチェックアウト ID（必須）
 *   amount                       — 金額（最小通貨単位。例: JPY の場合は円）
 *   currency                     — 通貨コード（例: "jpy"）
 *
 * 出力:
 *   token  — UCP トークン文字列（b-mcp-server の complete_checkout に渡す）
 *   expiry — 有効期限（ISO 8601）
 */
async function handleTokenize(body) {
  const { credential, binding, amount = 1000, currency = "jpy" } = body;

  if (!binding?.checkout_id) {
    return { status: 400, body: { error: "binding.checkout_id is required" } };
  }

  const token = generateToken();
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  if (!stripe) {
    // モックモード: Stripe なしで擬似トークンを発行
    const fakePaymentIntentId = `pi_mock_${randomBytes(10).toString("hex")}`;
    tokenStore.set(token, {
      paymentIntentId: fakePaymentIntentId,
      checkoutId: binding.checkout_id,
      amount,
      currency,
      expiresAt,
      isMock: true,
    });
    console.log(`[tokenize] mock token issued for checkout=${binding.checkout_id}`);
    return {
      status: 200,
      body: { token, expiry: new Date(expiresAt).toISOString(), _mock: true },
    };
  }

  // Stripe モード: PaymentIntent を作成
  const paymentMethodId = credential?.payment_method_id;
  if (!paymentMethodId) {
    return { status: 400, body: { error: "credential.payment_method_id is required" } };
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount: parseInt(amount, 10),
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirm: false,
      metadata: { checkout_id: binding.checkout_id },
    });

    tokenStore.set(token, {
      paymentIntentId: pi.id,
      checkoutId: binding.checkout_id,
      amount: pi.amount,
      currency: pi.currency,
      expiresAt,
      isMock: false,
    });

    console.log(`[tokenize] PI=${pi.id} issued for checkout=${binding.checkout_id}`);
    return {
      status: 200,
      body: { token, expiry: new Date(expiresAt).toISOString() },
    };
  } catch (e) {
    console.error("[tokenize] Stripe error:", e.message);
    return { status: 502, body: { error: "stripe_error", detail: e.message } };
  }
}

/**
 * POST /detokenize
 *
 * トークンを検証し、バインディングが一致することを確認したうえで
 * PaymentIntent の詳細を返す。トークンは単回使用（成功後に失効）。
 *
 * 入力:
 *   token                — /tokenize で取得したトークン
 *   binding.checkout_id  — バインド先のチェックアウト ID
 *
 * 出力:
 *   payment_intent_id     — Stripe PaymentIntent ID（モック時は pi_mock_*）
 *   payment_intent_status — "requires_confirmation" 等
 *   amount, currency      — 金額・通貨
 */
async function handleDetokenize(body) {
  const { token, binding } = body;

  if (!token) {
    return { status: 400, body: { error: "token is required" } };
  }

  const stored = tokenStore.get(token);
  if (!stored) {
    return { status: 404, body: { error: "token_not_found" } };
  }

  if (Date.now() > stored.expiresAt) {
    tokenStore.delete(token);
    return { status: 410, body: { error: "token_expired" } };
  }

  if (binding?.checkout_id && stored.checkoutId !== binding.checkout_id) {
    return { status: 403, body: { error: "binding_mismatch" } };
  }

  // 単回使用: 成功したら即失効
  tokenStore.delete(token);

  if (stored.isMock) {
    console.log(`[detokenize] mock token validated for PI=${stored.paymentIntentId}`);
    return {
      status: 200,
      body: {
        payment_intent_id: stored.paymentIntentId,
        payment_intent_status: "requires_confirmation",
        amount: stored.amount,
        currency: stored.currency,
        _mock: true,
      },
    };
  }

  // Stripe モード: PaymentIntent を取得して現在のステータスを返す
  try {
    const pi = await stripe.paymentIntents.retrieve(stored.paymentIntentId);
    console.log(`[detokenize] PI=${pi.id} status=${pi.status}`);
    return {
      status: 200,
      body: {
        payment_intent_id: pi.id,
        payment_intent_status: pi.status,
        amount: pi.amount,
        currency: pi.currency,
      },
    };
  } catch (e) {
    console.error("[detokenize] Stripe error:", e.message);
    return { status: 502, body: { error: "stripe_error", detail: e.message } };
  }
}

// ─── HTTP サーバー ─────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === "GET" && pathname === "/health") {
    return send(res, 200, {
      status: "ok",
      stripe_configured: !!stripe,
      active_tokens: tokenStore.size,
    });
  }

  if (req.method === "POST" && pathname === "/tokenize") {
    try {
      const body = await parseBody(req);
      const result = await handleTokenize(body);
      return send(res, result.status, result.body);
    } catch {
      return send(res, 400, { error: "invalid_request_body" });
    }
  }

  if (req.method === "POST" && pathname === "/detokenize") {
    try {
      const body = await parseBody(req);
      const result = await handleDetokenize(body);
      return send(res, result.status, result.body);
    } catch {
      return send(res, 400, { error: "invalid_request_body" });
    }
  }

  return send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`[d-payment-handler] http://localhost:${PORT}`);
  console.log(`  Stripe: ${stripe ? "configured (live mode)" : "NOT configured — mock mode"}`);
  console.log(`  Endpoints: POST /tokenize  POST /detokenize  GET /health`);
});
