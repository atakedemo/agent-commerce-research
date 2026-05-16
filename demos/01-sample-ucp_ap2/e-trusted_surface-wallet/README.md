# e-trusted_surface-wallet

AP2 Trusted Surface — HNP（Human Not Present）フロー向けのオープン Mandate 署名サーバー。

ユーザーが事前に設定した購入制約（Intent）を受け取り、Shopping Agent の公開鍵（`agent_pk`）を
`cnf` クレームとして埋め込んだオープン Checkout / Payment Mandate に ES256 署名して発行します。

## 役割（AP2 仕様上）

**Trusted Surface** — ユーザーから同意を得た後に Mandate Content に署名するコンポーネント。
本デモでは **Trusted Agent Provider モデル** を採用し、このサーバー自身の署名鍵（`user_sk`）で
Mandate を署名します。Verifier（Credential Provider / Merchant）は `GET /jwks` で公開鍵を取得して署名を検証します。

## エンドポイント

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| `GET` | `/health` | 不要 | 死活確認 |
| `GET` | `/jwks` | 不要 | 署名検証用 JWK セット（Verifier が参照） |
| `GET` | `/instruments` | API キー | 登録済み支払い手段一覧 |
| `POST` | `/open-mandate` | API キー | オープン Checkout + Payment Mandate の署名・発行 |

## 前提条件

- Node.js 18 以上（WebCrypto API 使用、追加パッケージ不要）

## 起動

```bash
cd demos/01-sample-ucp_ap2/e-trusted_surface-wallet
node src/server.js
```

環境変数:

```bash
TRUSTED_SURFACE_PORT=3300       # ポート（デフォルト: 3300）
TRUSTED_SURFACE_API_KEY=secret  # クライアント認証用 API キー（未設定時は認証なし）
MANDATE_TTL_SEC=3600            # オープン Mandate の有効期間（秒）
```

## API 使用例

### ヘルスチェック

```bash
curl http://localhost:3300/health
```

```json
{ "status": "ok", "issuer": "http://localhost:3300", "auth": "none", "instruments_count": 2 }
```

### JWK セット取得（Verifier 向け）

```bash
curl http://localhost:3300/jwks
```

```json
{ "keys": [{ "kty": "EC", "crv": "P-256", "x": "...", "y": "...", "kid": "ts-wallet-1", "use": "sig", "alg": "ES256" }] }
```

### 支払い手段一覧

```bash
curl http://localhost:3300/instruments
```

```json
{
  "instruments": [
    { "id": "card_visa_4242", "type": "card", "description": "Visa ···· 4242" },
    { "id": "card_mc_5555",   "type": "card", "description": "Mastercard ···· 5555" }
  ]
}
```

### オープン Mandate の発行（HNP フロー）

Shopping Agent は購入前に Agent 鍵ペアを生成し、公開鍵とユーザー Intent を渡してオープン Mandate を取得します。

```bash
curl -X POST http://localhost:3300/open-mandate \
  -H "Content-Type: application/json" \
  -d '{
    "agent_pk": {
      "kty": "EC", "crv": "P-256",
      "x": "<agent_public_key_x>",
      "y": "<agent_public_key_y>"
    },
    "intent": {
      "merchants": [{ "id": "merchant_1", "name": "Demo Merchant", "website": "http://localhost:9000" }],
      "items": [{ "id": "prod_abc123", "title": "Blue Running Shoes", "quantity": 1 }],
      "amount_range": { "max": 50000, "min": 0, "currency": "JPY" },
      "payment_instrument_id": "card_visa_4242"
    },
    "expiry_seconds": 3600
  }'
```

```json
{
  "open_checkout_mandate": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRzLXdhbGxldC0xIn0...",
  "open_payment_mandate": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRzLXdhbGxldC0xIn0...",
  "wallet_public_key": { "kty": "EC", "crv": "P-256", "x": "...", "y": "...", "kid": "ts-wallet-1" },
  "instruments": [{ "id": "card_visa_4242", "type": "card", "description": "Visa ···· 4242" }],
  "expires_at": "2026-05-15T10:37:00.000Z"
}
```

発行された JWT のペイロード例（`open_payment_mandate`）:

```json
{
  "iss": "http://localhost:3300",
  "vct": "mandate.payment.open.1",
  "iat": 1234567890,
  "exp": 1234571490,
  "jti": "uuid-...",
  "cnf": { "jwk": { "<agent_public_key_jwk>" } },
  "constraints": [
    { "type": "payment.amount_range", "max": 50000, "min": 0, "currency": "JPY" },
    { "type": "payment.allowed_payees", "allowed": [{ "id": "merchant_1", "name": "Demo Merchant" }] },
    { "type": "payment.allowed_payment_instruments", "allowed": [{ "id": "card_visa_4242", "type": "card" }] }
  ]
}
```

## 他サービスとの連携

```
AP2 HNP フロー:

e-trusted_surface-wallet (:3300)
  ↑ POST /open-mandate (Shopping Agent)
  ↓ open_checkout_mandate + open_payment_mandate (JWT)
  
  ← GET /jwks (Credential Provider が署名検証に使用)
  
d-payment_handler-credential_provider (:3200)
  TRUSTED_SURFACE_URL=http://localhost:3300
```

## 参考仕様

- [AP2 Specification](../../../../references/specification/community/AP2/docs/ap2/specification.md)
- [AP2 Flows](../../../../references/specification/community/AP2/docs/ap2/flows.md)
- [Agent Authorization](../../../../references/specification/community/AP2/docs/ap2/agent_authorization.md)
- [Payment Mandate](../../../../references/specification/community/AP2/docs/ap2/payment_mandate.md)
- [Checkout Mandate](../../../../references/specification/community/AP2/docs/ap2/checkout_mandate.md)
