import express from "express";
import { createHash, randomBytes, randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 4000;

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "../public")));

// CMWallet は Android プロセスとして /token・/credential を直接呼ぶため CORS ヘッダーが必要
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, DPoP, oauth-client-attestation, oauth-client-attestation-pop");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// CMWallet からのリクエストを全てログに出力（デバッグ用）
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} UA=${req.get("user-agent") ?? "-"}`);
  if (req.method === "POST") {
    console.log(`[REQ] body=${JSON.stringify(req.body)}`);
  }
  next();
});

// ── Issuer EC P-256 key pair (generated once at startup) ─────────────────────
let _keyPair = null;
let _publicJwk = null;

async function getKeyPair() {
  if (_keyPair) return { keyPair: _keyPair, publicJwk: _publicJwk };
  _keyPair = await globalThis.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,           // extractable (needed for JWK export and jwks.json)
    ["sign", "verify"],
  );
  _publicJwk = await globalThis.crypto.subtle.exportKey("jwk", _keyPair.publicKey);
  console.log("[startup] EC P-256 issuer key pair generated");
  return { keyPair: _keyPair, publicJwk: _publicJwk };
}

// ── SD-JWT helpers ───────────────────────────────────────────────────────────
function b64url(data) {
  return Buffer.from(data).toString("base64url");
}

function makeDisclosure(name, value) {
  const salt = randomBytes(16).toString("base64url");
  const disclosure = b64url(JSON.stringify([salt, name, value]));
  const hash = createHash("sha256").update(disclosure).digest("base64url");
  return { disclosure, hash };
}

async function issueDpcSdJwt(issuerUrl) {
  const { keyPair, publicJwk } = await getKeyPair();
  const now = Math.floor(Date.now() / 1000);

  const selectiveClaims = [
    ["card_last_four",             "9999"],
    ["card_art_url",               "https://pocketbank.example/card.png"],
    ["card_network_code",          "ACME"],
    ["card_cobadged_network_code", "LASER"],
    ["card_bin",                   "990001"],
    ["card_id",                    "5d8f7e9c0a12"],
    ["card_par",                   "9900ACK123XYZ789LMNOPQRSTUVWX"],
    ["credential_id",              randomUUID()],
  ];

  const disclosures = selectiveClaims.map(([n, v]) => makeDisclosure(n, v));

  // jwk in header allows CMWallet to verify without fetching jwks_uri
  const header = { alg: "ES256", typ: "dc+sd-jwt", jwk: publicJwk };
  const payload = {
    _sd:     disclosures.map(d => d.hash),
    iss:     issuerUrl,
    iat:     now,
    exp:     now + 86400 * 3650, // ~10 years
    vct:     "com.emvco.dpc",
    _sd_alg: "sha-256",
  };

  const headerB64  = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const toSign     = `${headerB64}.${payloadB64}`;

  const rawSig = await globalThis.crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    new TextEncoder().encode(toSign),
  );

  const sigB64 = Buffer.from(rawSig).toString("base64url");
  return `${toSign}.${sigB64}~${disclosures.map(d => d.disclosure).join("~")}~`;
}

// ── In-memory session stores ─────────────────────────────────────────────────
const preAuthCodes  = new Map(); // code  → { expiresAt }
const accessTokens  = new Map(); // token → { expiresAt }

function issuerBase(req) {
  if (process.env.ISSUER_BASE_URL) {
    return process.env.ISSUER_BASE_URL.replace(/\/$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
}

function authServerMetadata(base) {
  return {
    issuer:                base,
    token_endpoint:        `${base}/token`,
    grant_types_supported: ["urn:ietf:params:oauth:grant-type:pre-authorized_code"],
  };
}

function credentialIssuerMetadata(base) {
  return {
    credential_issuer:    base,
    token_endpoint:       `${base}/token`,
    credential_endpoint:  `${base}/credential`,
    jwks_uri:             `${base}/.well-known/jwks.json`,
    credential_configurations_supported: {
      "com.emvco.dpc": {
        format: "dc+sd-jwt",
        vct:    "com.emvco.dpc",
        scope:  "com.emvco.dpc",
        display: [
          {
            name:             "DPC Card ···· 9999",
            locale:           "en-US",
            background_color: "#1a2f5e",
            text_color:       "#ffffff",
          },
        ],
        claims: {
          card_last_four:             { display: [{ name: "Last Four", locale: "en-US" }] },
          card_network_code:          { display: [{ name: "Network",   locale: "en-US" }] },
          card_art_url:               {},
          credential_id:              {},
          card_bin:                   {},
          card_id:                    {},
          card_par:                   {},
          card_cobadged_network_code: {},
        },
      },
    },
  };
}

// ── GET /api/issuer-info ─────────────────────────────────────────────────────
app.get("/api/issuer-info", (req, res) => {
  res.json({ issuer_base: issuerBase(req) });
});

// ── GET /.well-known/jwks.json ───────────────────────────────────────────────
app.get("/.well-known/jwks.json", async (req, res) => {
  const { publicJwk } = await getKeyPair();
  res.json({ keys: [{ ...publicJwk, kid: "issuer-key-1", use: "sig" }] });
});

// ── GET /.well-known/openid-credential-issuer ────────────────────────────────
app.get("/.well-known/openid-credential-issuer", (req, res) => {
  res.json(credentialIssuerMetadata(issuerBase(req)));
});

// ── GET /.well-known/oauth-authorization-server ──────────────────────────────
app.get("/.well-known/oauth-authorization-server", (req, res) => {
  res.json(authServerMetadata(issuerBase(req)));
});

// ── GET /.well-known/openid-configuration ────────────────────────────────────
app.get("/.well-known/openid-configuration", (req, res) => {
  res.json(authServerMetadata(issuerBase(req)));
});

// ── GET /api/credential-offer ────────────────────────────────────────────────
app.get("/api/credential-offer", (req, res) => {
  const base = issuerBase(req);
  const code = randomUUID();
  preAuthCodes.set(code, { expiresAt: Date.now() + 600_000 }); // 10 min

  res.json({
    credential_issuer:            base,
    credential_configuration_ids: ["com.emvco.dpc"],
    grants: {
      "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
        "pre-authorized_code": code,
      },
    },
    authorization_server_metadata: authServerMetadata(base),
    credential_issuer_metadata:   credentialIssuerMetadata(base),
  });
});

// ── POST /token ──────────────────────────────────────────────────────────────
app.post("/token", (req, res) => {
  const grantType   = req.body.grant_type;
  const preAuthCode = req.body["pre-authorized_code"];
  const hasDpop     = !!req.headers["dpop"];
  console.log(`[token] grant_type=${grantType} code=${preAuthCode?.slice(0, 8)}… dpop=${hasDpop} knownCodes=${preAuthCodes.size}`);

  if (grantType !== "urn:ietf:params:oauth:grant-type:pre-authorized_code") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }

  const session = preAuthCodes.get(preAuthCode);
  if (!session || session.expiresAt < Date.now()) {
    preAuthCodes.delete(preAuthCode);
    return res.status(400).json({ error: "invalid_grant", error_description: "pre-authorized_code is invalid or expired" });
  }
  preAuthCodes.delete(preAuthCode);

  const token = randomUUID();
  accessTokens.set(token, { expiresAt: Date.now() + 300_000 }); // 5 min

  const tokenType = hasDpop ? "DPoP" : "Bearer";
  console.log(`[token] issued token_type=${tokenType}`);
  res.json({
    access_token: token,
    token_type:   tokenType,
    expires_in:   300,
    c_nonce:      randomUUID(),
  });
});

// ── POST /credential ─────────────────────────────────────────────────────────
app.post("/credential", async (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  // CMWallet は DPoP を使うため "Authorization: DPoP <token>" を送る。Bearer も受け付ける。
  const token = authHeader.replace(/^(Bearer|DPoP)\s+/i, "");
  console.log(`[credential] auth_scheme=${authHeader.split(" ")[0]} token=${token.slice(0, 8)}…`);

  const session = accessTokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    accessTokens.delete(token);
    return res.status(401).json({ error: "invalid_token" });
  }
  accessTokens.delete(token);

  const format = req.body.format ?? "dc+sd-jwt";
  if (format !== "dc+sd-jwt") {
    return res.status(400).json({ error: "unsupported_credential_format" });
  }

  console.log("[credential] issuing DPC SD-JWT dynamically");
  const credential = await issueDpcSdJwt(issuerBase(req));
  res.json({ credential, format: "dc+sd-jwt" });
});

// ── Cleanup expired sessions (every 5 min) ───────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of preAuthCodes) if (v.expiresAt < now) preAuthCodes.delete(k);
  for (const [k, v] of accessTokens) if (v.expiresAt < now) accessTokens.delete(k);
}, 300_000);

// Pre-warm the key pair at startup
getKeyPair().catch(err => console.error("[startup] key pair generation failed:", err));

app.listen(PORT, () => {
  console.log(`DPC Credential Issuer running at http://localhost:${PORT}`);
});
