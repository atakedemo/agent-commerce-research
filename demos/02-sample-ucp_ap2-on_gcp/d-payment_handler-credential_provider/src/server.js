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
import { randomBytes, createHash, pbkdf2 } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);

const STRIPE_SECRET_KEY    = process.env.STRIPE_SECRET_KEY    ?? null;
const PORT                 = parseInt(process.env.PAYMENT_HANDLER_PORT ?? "3200", 10);
const TOKEN_TTL_MS         = 30 * 60 * 1000; // 30 分
const AUTH_TOKEN_TTL_MS    = 24 * 60 * 60 * 1000; // 24 時間
const TRUSTED_SURFACE_URL  = process.env.TRUSTED_SURFACE_URL?.replace(/\/$/, "") ?? null;
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID ?? null;

// token → { paymentIntentId, checkoutId, expiresAt, isMock } または credential エントリ
const tokenStore = new Map();

// ─── ユーザーストア（in-memory） ────────────────────────────────────────────────
// email → { userId, email, passwordHash, salt, profile, cards, createdAt }
// cards: [{ cardId, last_four, brand, holder_name, exp_month, exp_year }]
const userStore = new Map();
// authToken → { userId, email, expiresAt }
const authTokenStore = new Map();

// カードブランド判定
function detectBrand(digits) {
  if (digits.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^6(?:011|5)/.test(digits)) return "discover";
  return "unknown";
}

// カードエントリを構築（番号はマスク、last_four / brand のみ保存）
function buildCardEntry({ card_number, exp_month, exp_year, holder_name }) {
  const digits = String(card_number ?? "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  return {
    cardId:      randomBytes(8).toString("hex"),
    last_four:   digits.slice(-4),
    brand:       detectBrand(digits),
    holder_name: (holder_name ?? "").trim(),
    exp_month:   String(exp_month ?? "").padStart(2, "0"),
    exp_year:    String(exp_year  ?? ""),
  };
}

async function hashPassword(password, salt) {
  const buf = await pbkdf2Async(password, salt, 100_000, 32, "sha256");
  return buf.toString("hex");
}

function generateAuthToken() {
  return `ph_tok_${randomBytes(24).toString("hex")}`;
}

function issueAuthToken(userId, email) {
  const token = generateAuthToken();
  const expiresAt = Date.now() + AUTH_TOKEN_TTL_MS;
  authTokenStore.set(token, { userId, email, expiresAt });
  return { token, expiresAt };
}

function verifyAuthToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const entry = authTokenStore.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { authTokenStore.delete(token); return null; }
  return entry;
}

// ─── Auth ハンドラ ──────────────────────────────────────────────────────────────

async function handleSignup(body) {
  const { email, password, profile = {}, card = null } = body;
  if (!email || !password) return { status: 400, body: { error: "email と password は必須です" } };
  if (userStore.has(email)) return { status: 409, body: { error: "このメールアドレスは既に登録されています" } };

  const salt         = randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(password, salt);
  const userId       = randomBytes(12).toString("hex");

  const cards = [];
  if (card) {
    const entry = buildCardEntry(card);
    if (entry) cards.push(entry);
  }

  userStore.set(email, { userId, email, passwordHash, salt, profile, cards, createdAt: Date.now() });

  const { token, expiresAt } = issueAuthToken(userId, email);
  console.log(`[auth/signup] user created email=${email} cards=${cards.length}`);
  return {
    status: 201,
    body: { access_token: token, expires_at: new Date(expiresAt).toISOString(), user: { userId, email, profile, cards } },
  };
}

async function handleLogin(body) {
  const { email, password } = body;
  if (!email || !password) return { status: 400, body: { error: "email と password は必須です" } };

  const user = userStore.get(email);
  if (!user) return { status: 401, body: { error: "メールアドレスまたはパスワードが正しくありません" } };

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { status: 401, body: { error: "メールアドレスまたはパスワードが正しくありません" } };

  const { token, expiresAt } = issueAuthToken(user.userId, email);
  console.log(`[auth/login] user logged in email=${email}`);
  return {
    status: 200,
    body: { access_token: token, expires_at: new Date(expiresAt).toISOString(), user: { userId: user.userId, email, profile: user.profile, cards: user.cards ?? [] } },
  };
}

async function handleGoogleAuth(body) {
  const { id_token } = body;
  if (!id_token) return { status: 400, body: { error: "id_token は必須です" } };

  // Google tokeninfo API でトークンを検証
  let googlePayload;
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`;
    const r = await fetch(url);
    if (!r.ok) return { status: 401, body: { error: "Google トークンの検証に失敗しました" } };
    googlePayload = await r.json();
  } catch (e) {
    return { status: 502, body: { error: "Google 認証サーバーへの接続に失敗しました", detail: e.message } };
  }

  if (GOOGLE_CLIENT_ID && googlePayload.aud !== GOOGLE_CLIENT_ID) {
    return { status: 401, body: { error: "Google トークンの audience が一致しません" } };
  }

  const email = googlePayload.email;
  if (!email) return { status: 401, body: { error: "Google アカウントのメールアドレスが取得できませんでした" } };

  // 既存ユーザーを検索 or 新規作成
  let user = userStore.get(email);
  if (!user) {
    const userId  = randomBytes(12).toString("hex");
    const profile = {
      first_name: googlePayload.given_name  ?? "",
      last_name:  googlePayload.family_name ?? "",
      picture:    googlePayload.picture     ?? "",
    };
    user = { userId, email, passwordHash: null, salt: null, profile, cards: [], createdAt: Date.now() };
    userStore.set(email, user);
    console.log(`[auth/google] new user created email=${email}`);
  } else {
    console.log(`[auth/google] existing user login email=${email}`);
  }

  const { token, expiresAt } = issueAuthToken(user.userId, email);
  return {
    status: 200,
    body: {
      access_token: token,
      expires_at:   new Date(expiresAt).toISOString(),
      user: { userId: user.userId, email, profile: user.profile, cards: user.cards ?? [] },
      google_info: {
        name:       googlePayload.name       ?? "",
        given_name: googlePayload.given_name  ?? "",
        family_name:googlePayload.family_name ?? "",
        picture:    googlePayload.picture     ?? "",
        email,
      },
    },
  };
}

function handleMe(req) {
  const entry = verifyAuthToken(req.headers.authorization);
  if (!entry) return { status: 401, body: { error: "認証が必要です" } };
  const user = userStore.get(entry.email);
  if (!user) return { status: 404, body: { error: "ユーザーが見つかりません" } };
  return { status: 200, body: { userId: user.userId, email: user.email, profile: user.profile, cards: user.cards ?? [] } };
}

function handleLogout(req) {
  if (!req.headers.authorization?.startsWith("Bearer ")) return { status: 200, body: { ok: true } };
  const token = req.headers.authorization.slice(7);
  authTokenStore.delete(token);
  return { status: 200, body: { ok: true } };
}

function handleAddCard(req, body) {
  const entry = verifyAuthToken(req.headers.authorization);
  if (!entry) return { status: 401, body: { error: "認証が必要です" } };
  const user = userStore.get(entry.email);
  if (!user) return { status: 404, body: { error: "ユーザーが見つかりません" } };

  const cardEntry = buildCardEntry(body);
  if (!cardEntry) return { status: 400, body: { error: "有効なカード番号が必要です" } };

  if (!user.cards) user.cards = [];
  user.cards.push(cardEntry);
  console.log(`[auth/cards] card added cardId=${cardEntry.cardId} last_four=${cardEntry.last_four} email=${entry.email}`);
  return { status: 201, body: { cards: user.cards } };
}

function handleDeleteCard(req, cardId) {
  const entry = verifyAuthToken(req.headers.authorization);
  if (!entry) return { status: 401, body: { error: "認証が必要です" } };
  const user = userStore.get(entry.email);
  if (!user) return { status: 404, body: { error: "ユーザーが見つかりません" } };

  const before = (user.cards ?? []).length;
  user.cards = (user.cards ?? []).filter(c => c.cardId !== cardId);
  if (user.cards.length === before) return { status: 404, body: { error: "カードが見つかりません" } };
  console.log(`[auth/cards] card deleted cardId=${cardId} email=${entry.email}`);
  return { status: 200, body: { cards: user.cards } };
}

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

/**
 * dSD-JWT チェーンからマンデートディスクロージャを抽出する（CP 内コピー）。
 * チェーン形式: dpc_jwt ~ dpc_discs ~~ KB-SD-JWT ~ mandate_disc_1 ~ mandate_disc_2 ~
 */
function parseDsdJwtChain(chain) {
  if (!chain || typeof chain !== "string") return { mandates: [] };
  const separatorIdx = chain.indexOf("~~");
  if (separatorIdx === -1) return { mandates: [] };
  const kbParts = chain.slice(separatorIdx + 2).split("~").filter(Boolean);
  const mandates = kbParts.slice(1).map(disc => {
    try {
      const arr = JSON.parse(Buffer.from(disc, "base64url").toString("utf8"));
      return Array.isArray(arr) && arr.length >= 2 ? arr[1] : null;
    } catch { return null; }
  }).filter(Boolean);
  return { mandates };
}

/**
 * POST /hp-credential
 *
 * AP2 HP（Human Present）フロー用クレデンシャル発行。
 * 2 種類の入力形式をサポート：
 *   (A) DC API フロー: dsd_jwt_chain（CMWallet が署名した dSD-JWT チェーン）
 *       または mandate_payloads（チェーンから抽出済みの mandate JSON 配列）
 *   (B) Mock TS フロー: l2_mandate（単一の KB-SD-JWT、TS サーバーが署名）
 *
 * 出力:
 *   token          クレデンシャルトークン（ucp_tok_*）
 *   expiry         有効期限（ISO 8601）
 *   transaction_id 取引識別子
 */
async function handleHpCredential(body) {
  const { l2_mandate, dsd_jwt_chain, mandate_payloads, checkout_hash } = body;

  let delegatePayload;

  if (Array.isArray(mandate_payloads) && mandate_payloads.length > 0) {
    // (A) DC API フロー: エージェントサーバーがチェーンから抽出済み
    delegatePayload = mandate_payloads;
  } else if (dsd_jwt_chain) {
    // (A) DC API フロー: チェーンを直接受け取った場合
    delegatePayload = parseDsdJwtChain(dsd_jwt_chain).mandates;
  } else if (l2_mandate) {
    // (B) Mock TS フロー: L2 Mandate JWT を検証・デコード
    let l2Payload;
    if (TRUSTED_SURFACE_URL) {
      const keys = await fetchTrustedSurfaceJwks();
      let verified = false;
      for (const jwk of keys) {
        try {
          l2Payload = await verifyJwt(l2_mandate, jwk);
          verified  = true;
          break;
        } catch {}
      }
      if (!verified) {
        return { status: 403, body: { error: "l2_mandate_signature_invalid" } };
      }
    } else {
      try   { l2Payload = decodeJwtPayload(l2_mandate); }
      catch { return { status: 400, body: { error: "invalid_l2_mandate" } }; }
    }
    delegatePayload = l2Payload?.delegate_payload ?? [];
  } else {
    return { status: 400, body: { error: "l2_mandate, dsd_jwt_chain, または mandate_payloads は必須です" } };
  }

  if (delegatePayload.length === 0) {
    return { status: 400, body: { error: "delegate_payload が空です" } };
  }

  // 2. delegate_payload から Payment Mandate を取得
  // DC API フロー: vct = "mandate.payment" / Mock TS フロー: vct = "mandate.payment.1"
  const paymentMandate  = delegatePayload.find((m) => m.vct === "mandate.payment.1" || m.vct === "mandate.payment");
  const checkoutMandate = delegatePayload.find((m) => m.vct === "mandate.checkout.1" || m.vct === "mandate.checkout");

  if (!paymentMandate) {
    return { status: 400, body: { error: "payment_mandate_not_found_in_delegate_payload" } };
  }

  // 3. checkout_hash 照合（オプション）
  const mandateCheckoutHash = checkoutMandate?.checkout_hash ?? paymentMandate?.transaction_id;
  if (checkout_hash && mandateCheckoutHash && checkout_hash !== mandateCheckoutHash) {
    return { status: 403, body: { error: "checkout_hash_mismatch" } };
  }

  // 4. Credential token を発行
  const token      = `ucp_tok_${randomBytes(16).toString("hex")}`;
  const expiresAt  = Date.now() + TOKEN_TTL_MS;
  const transId    = paymentMandate.transaction_id ?? randomBytes(16).toString("hex");
  const instrument = paymentMandate.payment_instrument ?? null;

  tokenStore.set(token, {
    type:              "credential",
    transactionId:     transId,
    payee:             paymentMandate.payee,
    paymentAmount:     paymentMandate.payment_amount,
    paymentInstrument: instrument,
    checkoutHash:      checkout_hash ?? mandateCheckoutHash,
    expiresAt,
    isMock:            !TRUSTED_SURFACE_URL,
  });

  console.log(`[hp-credential] HP token issued tx=${transId} mock=${!TRUSTED_SURFACE_URL}`);

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

  if (req.method === "POST" && pathname === "/hp-credential") {
    try {
      const body = await parseBody(req);
      const result = await handleHpCredential(body);
      return send(res, result.status, result.body);
    } catch (e) {
      console.error("[hp-credential] error:", e.message);
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

  // Auth エンドポイント
  if (req.method === "POST" && pathname === "/auth/signup") {
    try {
      const body = await parseBody(req);
      const result = await handleSignup(body);
      return send(res, result.status, result.body);
    } catch (e) {
      return send(res, 500, { error: "internal_error", detail: e.message });
    }
  }

  if (req.method === "POST" && pathname === "/auth/login") {
    try {
      const body = await parseBody(req);
      const result = await handleLogin(body);
      return send(res, result.status, result.body);
    } catch (e) {
      return send(res, 500, { error: "internal_error", detail: e.message });
    }
  }

  if (req.method === "POST" && pathname === "/auth/google") {
    try {
      const body = await parseBody(req);
      const result = await handleGoogleAuth(body);
      return send(res, result.status, result.body);
    } catch (e) {
      return send(res, 500, { error: "internal_error", detail: e.message });
    }
  }

  if (req.method === "GET" && pathname === "/auth/me") {
    const result = handleMe(req);
    return send(res, result.status, result.body);
  }

  if (req.method === "POST" && pathname === "/auth/logout") {
    const result = handleLogout(req);
    return send(res, result.status, result.body);
  }

  if (req.method === "POST" && pathname === "/auth/cards") {
    try {
      const body = await parseBody(req);
      const result = handleAddCard(req, body);
      return send(res, result.status, result.body);
    } catch (e) {
      return send(res, 500, { error: "internal_error", detail: e.message });
    }
  }

  // DELETE /auth/cards/:cardId
  if (req.method === "DELETE" && pathname.startsWith("/auth/cards/")) {
    const cardId = pathname.slice("/auth/cards/".length);
    if (!cardId) return send(res, 400, { error: "cardId は必須です" });
    const result = handleDeleteCard(req, cardId);
    return send(res, result.status, result.body);
  }

  return send(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  console.log(`[d-payment-handler-credential-provider] http://localhost:${PORT}`);
  console.log(`  Stripe:          ${stripe ? "configured (live mode)" : "NOT configured — mock mode"}`);
  console.log(`  Trusted Surface: ${TRUSTED_SURFACE_URL ?? "NOT configured — mandate verification skipped (mock)"}`);
  console.log(`  Endpoints (Payment Handler):    POST /tokenize  POST /detokenize  GET /health`);
  console.log(`  Endpoints (Credential Provider): POST /credential  POST /hp-credential  POST /credential/verify`);
  console.log(`  Endpoints (Auth):                POST /auth/signup  POST /auth/login  POST /auth/google  GET /auth/me  POST /auth/logout`);
  console.log(`  Google Client ID: ${GOOGLE_CLIENT_ID ?? "(未設定 — audience 検証スキップ)"}`);
});
