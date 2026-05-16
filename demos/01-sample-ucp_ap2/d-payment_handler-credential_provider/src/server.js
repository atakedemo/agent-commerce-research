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
import { randomBytes, createHash } from "node:crypto";

const STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY    ?? null;
const PORT                 = parseInt(process.env.PAYMENT_HANDLER_PORT ?? "3200", 10);
const TOKEN_TTL_MS         = 30 * 60 * 1000; // 30 分
const TRUSTED_SURFACE_URL  = process.env.TRUSTED_SURFACE_URL?.replace(/\/$/, "") ?? null;

// token → { paymentIntentId, checkoutId, expiresAt, isMock } または credential エントリ
const tokenStore = new Map();

// ─── AP2 Credential Provider ────────────────────────────────────────────────────

const { subtle } = globalThis.crypto;

/** JWKS キャッシュ（Trusted Surface の公開鍵を 5 分間キャッシュ） */
let _jwksCache     = null;
let _jwksCacheTime = 0;

async function fetchTrustedSurfaceJwks() {
  if (!TRUSTED_SURFACE_URL) return null;
  const now = Date.now();
  if (_jwksCache && now - _jwksCacheTime < 5 * 60 * 1000) return _jwksCache;
  const res = await fetch(`${TRUSTED_SURFACE_URL}/jwks`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = await res.json();
  _jwksCache     = data.keys ?? [];
  _jwksCacheTime = now;
  return _jwksCache;
}

/**
 * JWT または SD-JWT のペイロードを検証なしでデコードする。
 * SD-JWT フォーマット（<header>.<payload>.<sig>~[disclosures]）に対応。
 */
function decodeJwtPayload(token) {
  // SD-JWT の場合は最初の "~" より前が Issuer-signed JWT
  const jwt = token.split("~")[0];
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT format");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString());
}

/**
 * ES256 JWT / SD-JWT を指定の JWK で検証し、ペイロードを返す。
 * SD-JWT フォーマット（<header>.<payload>.<sig>~）に対応。
 */
async function verifyJwt(token, jwk) {
  // SD-JWT の場合は最初の "~" より前が署名対象
  const jwt = token.split("~")[0];
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const key = await subtle.importKey(
    "jwk", jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const signingInput = `${parts[0]}.${parts[1]}`;
  const valid = await subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    Buffer.from(parts[2], "base64url"),
    Buffer.from(signingInput),
  );
  if (!valid) throw new Error("JWT signature invalid");
  return decodeJwtPayload(token);
}

/**
 * POST /credential
 *
 * AP2 Credential Provider: Payment Mandate チェーンを検証し、
 * Payment Credential（payment token）を発行する。
 *
 * HNP フロー:
 *   1. TRUSTED_SURFACE_URL/jwks から公開鍵を取得してオープン Mandate を検証
 *   2. オープン Mandate の cnf.jwk（Agent 公開鍵）でクローズド Mandate を検証
 *   3. 制約（amount_range / allowed_payees / allowed_payment_instruments）を評価
 *   4. 検証成功時に payment credential token を発行
 *
 * 入力:
 *   open_payment_mandate   vct=mandate.payment.open.1 の JWT（Trusted Surface 署名）
 *   closed_payment_mandate vct=mandate.payment.1 の JWT（Agent 署名）
 *   checkout_hash          checkout_jwt の SHA-256 ハッシュ（base64url）
 *
 * 出力:
 *   token          クレデンシャルトークン（ucp_tok_*）
 *   expiry         有効期限（ISO 8601）
 *   transaction_id 取引識別子
 */
async function handleCredential(body) {
  const { open_payment_mandate, closed_payment_mandate, checkout_hash } = body;

  if (!open_payment_mandate || !closed_payment_mandate) {
    return {
      status: 400,
      body: { error: "open_payment_mandate と closed_payment_mandate は必須です" },
    };
  }

  // 1. オープン Mandate を検証
  let openPayload;
  if (TRUSTED_SURFACE_URL) {
    const keys = await fetchTrustedSurfaceJwks();
    let verified = false;
    for (const jwk of keys) {
      try {
        openPayload = await verifyJwt(open_payment_mandate, jwk);
        verified    = true;
        break;
      } catch {}
    }
    if (!verified) {
      return { status: 403, body: { error: "open_mandate_signature_invalid" } };
    }
  } else {
    // モード: 署名検証なしでデコードのみ（TRUSTED_SURFACE_URL 未設定時）
    try   { openPayload = decodeJwtPayload(open_payment_mandate); }
    catch { return { status: 400, body: { error: "invalid_open_mandate" } }; }
  }

  if (openPayload.vct !== "mandate.payment.open.1") {
    return { status: 400, body: { error: "invalid_open_mandate_vct", vct: openPayload.vct } };
  }

  // 2. クローズド Mandate を Agent 公開鍵で検証
  const agentJwk = openPayload?.cnf?.jwk;
  let closedPayload;
  if (agentJwk) {
    try   { closedPayload = await verifyJwt(closed_payment_mandate, agentJwk); }
    catch (e) {
      return { status: 403, body: { error: "closed_mandate_signature_invalid", detail: e.message } };
    }
  } else {
    try   { closedPayload = decodeJwtPayload(closed_payment_mandate); }
    catch { return { status: 400, body: { error: "invalid_closed_mandate" } }; }
  }

  if (closedPayload.vct !== "mandate.payment.1") {
    return { status: 400, body: { error: "invalid_closed_mandate_vct", vct: closedPayload.vct } };
  }

  // 2b. sd_hash 検証: Closed Mandate が Open Mandate に暗号的にバインドされているか確認
  // sd_hash = base64url(SHA-256(open_payment_mandate_sdJwt))
  if (closedPayload.sd_hash) {
    const expectedSdHash = createHash("sha256")
      .update(open_payment_mandate)
      .digest("base64url");
    if (closedPayload.sd_hash !== expectedSdHash) {
      return { status: 403, body: { error: "sd_hash_mismatch" } };
    }
  }

  // 3. 制約評価
  const constraints = openPayload.constraints ?? [];

  // payment.amount_range
  const amountRangeC = constraints.find((c) => c.type === "payment.amount_range");
  if (amountRangeC) {
    const { min = 0, max, currency } = amountRangeC;
    const { amount, currency: pCur } = closedPayload.payment_amount ?? {};
    if (amount == null) {
      return { status: 403, body: { error: "constraint_violation", constraint: "payment.amount_range", reason: "payment_amount missing" } };
    }
    if (max != null && amount > max) {
      return { status: 403, body: { error: "constraint_violation", constraint: "payment.amount_range", reason: `amount ${amount} > max ${max}` } };
    }
    if (amount < min) {
      return { status: 403, body: { error: "constraint_violation", constraint: "payment.amount_range", reason: `amount ${amount} < min ${min}` } };
    }
    if (currency && pCur && currency.toUpperCase() !== pCur.toUpperCase()) {
      return { status: 403, body: { error: "constraint_violation", constraint: "payment.amount_range", reason: `currency mismatch: ${pCur} !== ${currency}` } };
    }
  }

  // payment.allowed_payees
  const allowedPayeesC = constraints.find((c) => c.type === "payment.allowed_payees");
  if (allowedPayeesC && closedPayload.payee) {
    const payee   = closedPayload.payee;
    const allowed = allowedPayeesC.allowed ?? [];
    const ok      = allowed.some((a) => (a.id && a.id === payee.id) || (a.name && a.name === payee.name));
    if (!ok) {
      return { status: 403, body: { error: "constraint_violation", constraint: "payment.allowed_payees" } };
    }
  }

  // payment.allowed_payment_instruments
  // payment_instrument は { id, type, description } オブジェクト（AP2 仕様）
  const instrument = closedPayload.payment_instrument ?? null;
  const allowedInstC = constraints.find((c) => c.type === "payment.allowed_payment_instruments");
  if (allowedInstC && instrument) {
    const allowed = allowedInstC.allowed ?? [];
    const ok      = allowed.some((a) => a.id === instrument.id || a.type === instrument.type);
    if (!ok) {
      return { status: 403, body: { error: "constraint_violation", constraint: "payment.allowed_payment_instruments" } };
    }
  }

  // 4. Credential token を発行
  const token      = `ucp_tok_${randomBytes(16).toString("hex")}`;
  const expiresAt  = Date.now() + TOKEN_TTL_MS;
  const transId    = closedPayload.transaction_id ?? randomBytes(16).toString("hex");

  tokenStore.set(token, {
    type:              "credential",
    transactionId:     transId,
    payee:             closedPayload.payee,
    paymentAmount:     closedPayload.payment_amount,
    paymentInstrument: instrument,
    checkoutHash:      checkout_hash,
    expiresAt,
    isMock:            !TRUSTED_SURFACE_URL,
  });

  console.log(`[credential] token issued tx=${transId} mock=${!TRUSTED_SURFACE_URL}`);

  return {
    status: 200,
    body: {
      token,
      expiry:         new Date(expiresAt).toISOString(),
      transaction_id: transId,
      ...(TRUSTED_SURFACE_URL ? {} : { _mock: true }),
    },
  };
}

/**
 * POST /credential/verify
 *
 * 発行済み credential token の内容を確認する（b-mcp-server の complete_checkout から利用）。
 * 単回使用（検証成功後に失効）。
 */
async function handleCredentialVerify(body) {
  const { token, checkout_hash } = body;
  if (!token) return { status: 400, body: { error: "token is required" } };

  const stored = tokenStore.get(token);
  if (!stored || stored.type !== "credential") {
    return { status: 404, body: { error: "token_not_found" } };
  }
  if (Date.now() > stored.expiresAt) {
    tokenStore.delete(token);
    return { status: 410, body: { error: "token_expired" } };
  }
  if (checkout_hash && stored.checkoutHash && stored.checkoutHash !== checkout_hash) {
    return { status: 403, body: { error: "checkout_hash_mismatch" } };
  }

  tokenStore.delete(token);

  return {
    status: 200,
    body: {
      transaction_id:     stored.transactionId,
      payee:              stored.payee,
      payment_amount:     stored.paymentAmount,
      payment_instrument: stored.paymentInstrument,
      ...(stored.isMock ? { _mock: true } : {}),
    },
  };
}

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
    return { status: 404, body: { error: "token_not_found", token } };
  }

  if (Date.now() > stored.expiresAt) {
    tokenStore.delete(token);
    return { status: 410, body: { error: "token_expired", token, checkout_id: stored.checkoutId } };
  }

  if (stored.type === "credential") {
    // AP2 credential トークン: checkout_hash で同一チェックアウトセッションを検証する。
    // checkout_hash は create_checkout が生成した Merchant-signed Checkout JWT の SHA-256。
    if (binding?.checkout_hash && stored.checkoutHash && stored.checkoutHash !== binding.checkout_hash) {
      return {
        status: 403,
        body: {
          error:                    "checkout_hash_mismatch",
          token,
          token_checkout_hash:      stored.checkoutHash,
          request_checkout_hash:    binding.checkout_hash,
        },
      };
    }
  } else {
    // UCP tokenize トークン: checkout_id で一致を検証する。
    if (binding?.checkout_id && stored.checkoutId !== binding.checkout_id) {
      return {
        status: 403,
        body: {
          error:                "binding_mismatch",
          token,
          token_checkout_id:    stored.checkoutId,
          request_checkout_id:  binding.checkout_id,
        },
      };
    }
  }

  // 単回使用: 成功したら即失効
  tokenStore.delete(token);

  // AP2 credential トークンの場合はクレデンシャル情報を返す
  if (stored.type === "credential") {
    console.log(`[detokenize] AP2 credential token validated tx=${stored.transactionId}`);
    return {
      status: 200,
      body: {
        transaction_id:     stored.transactionId,
        payment_amount:     stored.paymentAmount,
        payment_instrument: stored.paymentInstrument,
        _ap2:               true,
        _mock:              stored.isMock,
      },
    };
  }

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
      status:              "ok",
      stripe_configured:   !!stripe,
      trusted_surface_url: TRUSTED_SURFACE_URL ?? "(not configured — mock mode)",
      active_tokens:       tokenStore.size,
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

  // AP2 Credential Provider エンドポイント
  if (req.method === "POST" && pathname === "/credential") {
    try {
      const body = await parseBody(req);
      const result = await handleCredential(body);
      return send(res, result.status, result.body);
    } catch (e) {
      console.error("[credential] error:", e.message);
      return send(res, 500, { error: "internal_error", detail: e.message });
    }
  }

  if (req.method === "POST" && pathname === "/credential/verify") {
    try {
      const body = await parseBody(req);
      const result = await handleCredentialVerify(body);
      return send(res, result.status, result.body);
    } catch {
      return send(res, 400, { error: "invalid_request_body" });
    }
  }

  return send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`[d-payment-handler-credential-provider] http://localhost:${PORT}`);
  console.log(`  Stripe:          ${stripe ? "configured (live mode)" : "NOT configured — mock mode"}`);
  console.log(`  Trusted Surface: ${TRUSTED_SURFACE_URL ?? "NOT configured — mandate verification skipped (mock)"}`);
  console.log(`  Endpoints (Payment Handler):    POST /tokenize  POST /detokenize  GET /health`);
  console.log(`  Endpoints (Credential Provider): POST /credential  POST /credential/verify`);
});
