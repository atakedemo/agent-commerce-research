# d-payment_handler-credential_provider

UCP Payment Handler（Stripe ベースのトークン発行）と AP2 Credential Provider を兼ねるサーバー。

## 役割

| 機能 | 説明 |
|---|---|
| **Payment Handler** | `POST /tokenize` で UCP トークンを発行し、`POST /detokenize` でトークンを検証・デコード |
| **Credential Provider (AP2)** | `POST /credential` で Payment Mandate チェーンを検証し Payment Credential を発行 |

`STRIPE_SECRET_KEY` が未設定の場合はモックモードで動作し、Stripe API を呼ばずに擬似トークンを返します。  
`TRUSTED_SURFACE_URL` が未設定の場合は AP2 Mandate の署名検証をスキップします（モックモード）。

## エンドポイント

### Payment Handler（従来フロー）

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/tokenize` | Stripe PaymentIntent を作成して UCP トークンを返す |
| `POST` | `/detokenize` | トークンを検証し PaymentIntent 情報を返す（単回使用） |
| `GET` | `/health` | 死活確認 |

### Credential Provider（AP2 HNP フロー）

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/credential` | Payment Mandate チェーンを検証し Payment Credential token を発行 |
| `POST` | `/credential/verify` | 発行済み Credential token の内容確認（単回使用） |

## 前提条件

- Node.js 18 以上（WebCrypto API 使用、追加パッケージ不要）

## セットアップ

```bash
cd demos/01-sample-ucp_ap2/d-payment_handler-credential_provider
npm install
```

## 起動

### モックモード（Stripe キー・Trusted Surface URL 不要）

Stripe API と AP2 Mandate 検証をスキップし、擬似トークンを返します。

```bash
node src/server.js
```

### AP2 HNP フロー対応モード

```bash
TRUSTED_SURFACE_URL=http://localhost:3300 \
STRIPE_SECRET_KEY=sk_test_... \
node src/server.js
```

### ポートの変更（デフォルト: 3200）

```bash
PAYMENT_HANDLER_PORT=3200 node src/server.js
```

起動すると以下のログが出力されます。

```
[d-payment-handler-credential-provider] http://localhost:3200
  Stripe:          NOT configured — mock mode
  Trusted Surface: NOT configured — mandate verification skipped (mock)
  Endpoints (Payment Handler):    POST /tokenize  POST /detokenize  GET /health
  Endpoints (Credential Provider): POST /credential  POST /credential/verify
```

## 動作確認

### ヘルスチェック

```bash
curl http://localhost:3200/health
```

```json
{
  "status": "ok",
  "stripe_configured": false,
  "active_tokens": 0
}
```

### 決済トークンの発行（/tokenize）

```bash
curl -X POST http://localhost:3200/tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "credential": { "payment_method_id": "pm_card_visa" },
    "binding": { "checkout_id": "co_test_001" },
    "amount": 1000,
    "currency": "jpy"
  }'
```

```json
{
  "token": "ucp_tok_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expiry": "2026-05-10T10:30:00.000Z",
  "_mock": true
}
```

### トークンの検証・デコード（/detokenize）

```bash
curl -X POST http://localhost:3200/detokenize \
  -H "Content-Type: application/json" \
  -d '{
    "token": "ucp_tok_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "binding": { "checkout_id": "co_test_001" }
  }'
```

```json
{
  "payment_intent_id": "pi_mock_xxxxxxxxxxxxxxxxxx",
  "payment_intent_status": "requires_confirmation",
  "amount": 1000,
  "currency": "jpy",
  "_mock": true
}
```

> **注意**: `/detokenize` はトークンを単回使用で失効させます。同じトークンを 2 回送ると `404 token_not_found` が返ります。

### AP2 Credential Provider の動作確認（/credential）

```bash
curl -X POST http://localhost:3200/credential \
  -H "Content-Type: application/json" \
  -d '{
    "open_payment_mandate":   "<e-trusted_surface-wallet から取得した JWT>",
    "closed_payment_mandate": "<Agent が署名したクローズド Mandate JWT>",
    "checkout_hash":          "<b-mcp-server create_checkout の checkout_hash>"
  }'
```

```json
{
  "token": "ucp_tok_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expiry": "2026-05-15T11:00:00.000Z",
  "transaction_id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "_mock": true
}
```

`TRUSTED_SURFACE_URL` が設定されている場合、`_mock` フィールドは返されず、Mandate 署名の検証が行われます。

## 他サービスとの連携

### b-mcp-server と連携する場合（従来フロー）

```bash
# demos/01-sample-ucp_ap2/b-mcp-server/.env
PAYMENT_HANDLER_URL=http://localhost:3200
```

`create_checkout` のレスポンスに `payment_handlers` が追加され、`complete_checkout` 時にトークンの検証と Stripe PaymentIntent の確定が自動的に行われます。

### e-trusted_surface-wallet と連携する場合（AP2 HNP フロー）

```bash
# AP2 Credential Provider として Trusted Surface の JWKS を参照
TRUSTED_SURFACE_URL=http://localhost:3300 node src/server.js
```

起動後、`POST /credential` で受け取ったオープン Mandate の署名を `e-trusted_surface-wallet/jwks` から取得した公開鍵で検証します。

### c-ai-agent-app と連携する場合

```bash
# demos/01-sample-ucp_ap2/c-ai-agent-app/.env
PAYMENT_HANDLER_URL=http://localhost:3200
```

デモフロー実行後に UI のクレジットカードフォームが表示され、`POST /tokenize` を呼び出してトークンを発行できます。

## 起動順序（AP2 HNP フロー連携時）

```bash
# 1. Trusted Surface（Wallet）—— AP2 HNP フロー用
cd demos/01-sample-ucp_ap2/e-trusted_surface-wallet
node src/server.js                        # :3300

# 2. Payment Handler + Credential Provider（別ターミナル）
cd demos/01-sample-ucp_ap2/d-payment_handler-credential_provider
TRUSTED_SURFACE_URL=http://localhost:3300 node src/server.js  # :3200

# 3. MCP サーバー（b-mcp-server は c-ai-agent-app から自動起動）

# 4. AI エージェントアプリ（別ターミナル）
cd demos/01-sample-ucp_ap2/c-ai-agent-app
npm start
```

## エラーレスポンス一覧

### Payment Handler

| ステータス | エラーコード | 説明 |
|---|---|---|
| 400 | `binding.checkout_id is required` | `checkout_id` が未指定 |
| 400 | `credential.payment_method_id is required` | Stripe モードで `payment_method_id` が未指定 |
| 400 | `token is required` | トークンが未指定 |
| 403 | `binding_mismatch` | `checkout_id` がトークン発行時と一致しない |
| 404 | `token_not_found` | トークンが存在しない（未発行または使用済み） |
| 410 | `token_expired` | トークンの有効期限（30 分）が切れた |
| 502 | `stripe_error` | Stripe API エラー |

### Credential Provider（AP2）

| ステータス | エラーコード | 説明 |
|---|---|---|
| 400 | `open_payment_mandate と closed_payment_mandate は必須です` | 必須フィールド不足 |
| 400 | `invalid_open_mandate_vct` | `vct` が `mandate.payment.open.1` でない |
| 400 | `invalid_closed_mandate_vct` | `vct` が `mandate.payment.1` でない |
| 403 | `open_mandate_signature_invalid` | Trusted Surface の公開鍵で署名検証に失敗 |
| 403 | `closed_mandate_signature_invalid` | Agent 公開鍵（cnf.jwk）で署名検証に失敗 |
| 403 | `constraint_violation` | 制約（amount_range / allowed_payees 等）に違反 |
| 403 | `checkout_hash_mismatch` | `/credential/verify` でチェックアウトハッシュ不一致 |
| 404 | `token_not_found` | Credential token が存在しない |
| 410 | `token_expired` | Credential token の有効期限（30 分）が切れた |
| 502 | `jwks_fetch_failed` | Trusted Surface の JWKS 取得に失敗 |
