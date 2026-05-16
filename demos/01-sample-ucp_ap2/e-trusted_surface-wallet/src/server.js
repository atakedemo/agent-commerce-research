#!/usr/bin/env node
/**
 * AP2 Trusted Surface — Wallet (e-trusted_surface-wallet)
 *
 * HNP（Human Not Present）フロー向けのオープン Mandate 署名サーバー。
 * ユーザーが事前に承認した Mandate Content に署名し、Shopping Agent に委任する。
 *
 * 認証モデル: Trusted Agent Provider — このサーバー自身の署名鍵（user_sk）で
 *   Mandate を署名する。Verifier（Credential Provider / Merchant）は JWKS で検証。
 *
 * Endpoints:
 *   GET  /health        死活確認
 *   GET  /jwks          署名検証用公開鍵セット（JWK Set）
 *   GET  /instruments   登録済み支払い手段一覧（認証要）
 *   POST /open-mandate  オープン Checkout + Payment Mandate の署名（認証要）
 *
 * Environment:
 *   TRUSTED_SURFACE_PORT     HTTP ポート（デフォルト: 3300）
 *   TRUSTED_SURFACE_API_KEY  クライアント認証用 API キー（未設定時は認証なし）
 *   TRUSTED_SURFACE_ISSUER   Mandate の iss クレーム（デフォルト: http://localhost:3300）
 *   MANDATE_TTL_SEC          オープン Mandate の有効期間（秒、デフォルト: 3600）
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT    = parseInt(process.env.TRUSTED_SURFACE_PORT    ?? "3300", 10);
const API_KEY = process.env.TRUSTED_SURFACE_API_KEY          ?? null;
const ISSUER  = process.env.TRUSTED_SURFACE_ISSUER           ?? `http://localhost:${PORT}`;
const TTL_SEC = parseInt(process.env.MANDATE_TTL_SEC         ?? "3600", 10);

// ─── WebCrypto ─────────────────────────────────────────────────────────────────

const { subtle } = globalThis.crypto;

// Wallet 署名鍵ペアを起動時に生成（P-256 / ES256）
const KEY_PAIR = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const KEY_ID = "ts-wallet-1";

/** JWK 形式で公開鍵を取得し kid / use / alg を付与する */
const PUBLIC_JWK = {
  ...(await subtle.exportKey("jwk", KEY_PAIR.publicKey)),
  kid: KEY_ID,
  use: "sig",
  alg: "ES256",
};

// ─── JWT ユーティリティ ──────────────────────────────────────────────────────────

function b64url(data) {
  const s = typeof data === "string" ? data : JSON.stringify(data);
  return Buffer.from(s).toString("base64url");
}

/**
 * AP2 Mandate を SD-JWT 形式（RFC 9901 / OpenID4VC）で発行する。
 *
 * フォーマット: <header>.<payload>.<sig>~
 *   - typ: "dc+sd-jwt"  (Verifiable Credential as SD-JWT)
 *   - _sd_alg: "sha-256" を payload に追加
 *   - 末尾 "~" は選択的開示なし（全クレームが Issuer-signed JWT に含まれる）
 *
 * WebCrypto の sign() は raw (r||s) を返すので base64url 化をそのまま行える。
 */
async function signSdJwt(payload, privateKey, headerExtra = {}) {
  const header = { alg: "ES256", typ: "dc+sd-jwt", kid: KEY_ID, ...headerExtra };
  const payloadWithAlg = { _sd_alg: "sha-256", ...payload };
  const signingInput = `${b64url(header)}.${b64url(payloadWithAlg)}`;
  const sigBuf = await subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    Buffer.from(signingInput),
  );
  // SD-JWT: <Issuer-signed JWT>~ （選択的開示なし = 末尾 ~ のみ）
  return `${signingInput}.${Buffer.from(sigBuf).toString("base64url")}~`;
}

// ─── 登録済み支払い手段（デモ用固定値）───────────────────────────────────────────

const INSTRUMENTS = [
  {
    id:              "card_visa_4242",
    type:            "card",
    description:     "Visa ···· 4242",
    card_last_four:  "4242",
    card_network:    "visa",
  },
  {
    id:              "card_mc_5555",
    type:            "card",
    description:     "Mastercard ···· 5555",
    card_last_four:  "5555",
    card_network:    "mastercard",
  },
];

// ─── HTTP ユーティリティ ─────────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try   { resolve(JSON.parse(data || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

/** クライアント認証（x-api-key）を確認する。API_KEY 未設定時は常に OK。 */
function authorized(req, res) {
  if (!API_KEY) return true;
  if (req.headers["x-api-key"] === API_KEY) return true;
  send(res, 401, { error: "unauthorized", message: "x-api-key が不正です" });
  return false;
}

// ─── ハンドラ ──────────────────────────────────────────────────────────────────

/**
 * POST /open-mandate
 *
 * HNP フロー用オープン Mandate の生成・署名。
 * ユーザーが承認した Intent（制約集合）を元に、Shopping Agent の公開鍵（agent_pk）を
 * cnf クレームとして埋め込んだオープン Mandate を発行する。
 *
 * 入力:
 *   agent_pk              Shopping Agent の JWK 公開鍵（P-256）
 *   intent.merchants      許可するマーチャントのリスト [{ id, name, website }]
 *   intent.items          購入対象アイテム [{ id, title, quantity }]
 *   intent.amount_range   許可金額範囲 { max, min, currency }
 *   intent.payment_instrument_id  使用する支払い手段 ID
 *   expiry_seconds        有効期間（秒、省略時は MANDATE_TTL_SEC）
 *
 * 出力:
 *   open_checkout_mandate  vct=mandate.checkout.open.1 の署名付き JWT
 *   open_payment_mandate   vct=mandate.payment.open.1 の署名付き JWT
 *   wallet_public_key      署名検証用 JWK 公開鍵
 *   instruments            選択された支払い手段情報
 *   expires_at             有効期限（ISO 8601）
 */
async function handleOpenMandate(body) {
  const { agent_pk, intent = {}, expiry_seconds } = body;

  if (!agent_pk) {
    return { status: 400, body: { error: "agent_pk is required" } };
  }

  const merchants       = intent.merchants    ?? [];
  const items           = intent.items        ?? [];
  const amountRange     = intent.amount_range ?? { max: 100000, min: 0, currency: "JPY" };
  const instrumentId    = intent.payment_instrument_id ?? INSTRUMENTS[0].id;
  const expirySec       = expiry_seconds ?? TTL_SEC;

  const instrument = INSTRUMENTS.find((i) => i.id === instrumentId) ?? INSTRUMENTS[0];
  const now        = Math.floor(Date.now() / 1000);
  const exp        = now + expirySec;

  // ── オープン Checkout Mandate コンテンツ ────────────────────────────────────
  const openCheckoutContent = {
    iss:         ISSUER,
    vct:         "mandate.checkout.open.1",
    iat:         now,
    exp,
    jti:         randomUUID(),
    cnf:         { jwk: agent_pk },
    constraints: [
      ...(merchants.length > 0
        ? [{ type: "checkout.allowed_merchants", allowed: merchants }]
        : []),
      ...(items.length > 0
        ? [{
            type:  "checkout.line_items",
            items: items.map((item, i) => ({
              id:               `line_${i + 1}`,
              acceptable_items: [{ id: item.id, title: item.title ?? item.id }],
              quantity:         item.quantity ?? 1,
            })),
          }]
        : []),
    ],
  };

  // ── オープン Payment Mandate コンテンツ ──────────────────────────────────────
  const openPaymentContent = {
    iss:         ISSUER,
    vct:         "mandate.payment.open.1",
    iat:         now,
    exp,
    jti:         randomUUID(),
    cnf:         { jwk: agent_pk },
    constraints: [
      {
        type:     "payment.amount_range",
        max:      amountRange.max,
        min:      amountRange.min ?? 0,
        currency: amountRange.currency,
      },
      ...(merchants.length > 0
        ? [{
            type:    "payment.allowed_payees",
            allowed: merchants.map((m) => ({ id: m.id, name: m.name, website: m.website })),
          }]
        : []),
      {
        type:    "payment.allowed_payment_instruments",
        allowed: [{
          id:          instrument.id,
          type:        instrument.type,
          description: instrument.description,
        }],
      },
    ],
  };

  // ── 署名（SD-JWT 形式で発行）────────────────────────────────────────────────
  const openCheckoutMandate = await signSdJwt(openCheckoutContent, KEY_PAIR.privateKey);
  const openPaymentMandate  = await signSdJwt(openPaymentContent,  KEY_PAIR.privateKey);

  console.log(`[open-mandate] issued checkout+payment mandates, exp=${new Date(exp * 1000).toISOString()}`);

  return {
    status: 200,
    body: {
      open_checkout_mandate: openCheckoutMandate,
      open_payment_mandate:  openPaymentMandate,
      wallet_public_key:     PUBLIC_JWK,
      instruments:           [instrument],
      expires_at:            new Date(exp * 1000).toISOString(),
    },
  };
}

// ─── HTTP サーバー ─────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);

  // GET /health
  if (req.method === "GET" && pathname === "/health") {
    return send(res, 200, {
      status:            "ok",
      issuer:            ISSUER,
      auth:              API_KEY ? "api-key" : "none",
      instruments_count: INSTRUMENTS.length,
    });
  }

  // GET /jwks  — 公開鍵セット（認証不要、Verifier が参照する）
  if (req.method === "GET" && pathname === "/jwks") {
    return send(res, 200, { keys: [PUBLIC_JWK] });
  }

  // GET /instruments  — 支払い手段一覧（認証要）
  if (req.method === "GET" && pathname === "/instruments") {
    if (!authorized(req, res)) return;
    return send(res, 200, { instruments: INSTRUMENTS });
  }

  // POST /open-mandate  — オープン Mandate の署名（認証要）
  if (req.method === "POST" && pathname === "/open-mandate") {
    if (!authorized(req, res)) return;
    try {
      const body   = await parseBody(req);
      const result = await handleOpenMandate(body);
      return send(res, result.status, result.body);
    } catch (e) {
      console.error("[open-mandate] error:", e.message);
      return send(res, 400, { error: "invalid_request", detail: e.message });
    }
  }

  return send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`[e-trusted-surface-wallet] http://localhost:${PORT}`);
  console.log(`  Auth: ${API_KEY ? "API key required (x-api-key)" : "open (no auth)"}`);
  console.log(`  Mandate TTL: ${TTL_SEC}s`);
  console.log(`  Endpoints: GET /jwks  GET /instruments  POST /open-mandate`);
});
