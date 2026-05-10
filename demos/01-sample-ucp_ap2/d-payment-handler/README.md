# d-payment-handler

UCP Payment Handler — Stripe ベースの決済トークン発行サーバー。

`POST /tokenize` で UCP トークンを発行し、`POST /detokenize` でトークンを検証・デコードします。  
`STRIPE_SECRET_KEY` が未設定の場合はモックモードで動作し、Stripe API を呼ばずに擬似トークンを返します。

## エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/tokenize` | Stripe PaymentIntent を作成して UCP トークンを返す |
| `POST` | `/detokenize` | トークンを検証し PaymentIntent 情報を返す（単回使用） |
| `GET` | `/health` | 死活確認 |

## 前提条件

- Node.js 18 以上

## セットアップ

```bash
cd demos/01-sample-ucp_ap2/d-payment-handler
npm install
```

## 起動

### モックモード（Stripe キー不要）

Stripe API を呼ばず、擬似トークン（`ucp_tok_*`）と擬似 PaymentIntent ID（`pi_mock_*`）を返します。  
`b-mcp-server` や `c-ai-agent-app` との結合確認に利用できます。

```bash
node src/server.js
```

### Stripe 実モード

```bash
STRIPE_SECRET_KEY=sk_test_... node src/server.js
```

### ポートの変更（デフォルト: 3200）

```bash
PAYMENT_HANDLER_PORT=3200 node src/server.js
```

起動すると以下のログが出力されます。

```
[d-payment-handler] http://localhost:3200
  Stripe: NOT configured — mock mode
  Endpoints: POST /tokenize  POST /detokenize  GET /health
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

## 他サービスとの連携

### b-mcp-server と連携する場合

`b-mcp-server` の環境変数に `PAYMENT_HANDLER_URL` を設定します。

```bash
# demos/01-sample-ucp_ap2/b-mcp-server/.env
PAYMENT_HANDLER_URL=http://localhost:3200
```

`create_checkout` のレスポンスに `payment_handlers` が追加され、`complete_checkout` 時にトークンの検証と Stripe PaymentIntent の確定が自動的に行われます。

### c-ai-agent-app と連携する場合

`c-ai-agent-app` の環境変数に `PAYMENT_HANDLER_URL` を設定します（`.env` に記載済み）。

```bash
# demos/01-sample-ucp_ap2/c-ai-agent-app/.env
PAYMENT_HANDLER_URL=http://localhost:3200
```

デモフロー実行後に UI のクレジットカードフォームが表示され、`POST /tokenize` を呼び出してトークンを発行できます。

## 起動順序（全サービス連携時）

```bash
# 1. Medusa EC バックエンド（オプション）
cd demos/01-sample-ucp_ap2/a-sandbox-ec
npm run dev

# 2. Payment Handler（別ターミナル）
cd demos/01-sample-ucp_ap2/d-payment-handler
node src/server.js

# 3. MCP サーバー（b-mcp-server は c-ai-agent-app から自動起動）

# 4. AI エージェントアプリ（別ターミナル）
cd demos/01-sample-ucp_ap2/c-ai-agent-app
npm start
```

## エラーレスポンス一覧

| ステータス | エラーコード | 説明 |
|---|---|---|
| 400 | `binding.checkout_id is required` | `checkout_id` が未指定 |
| 400 | `credential.payment_method_id is required` | Stripe モードで `payment_method_id` が未指定 |
| 400 | `token is required` | トークンが未指定 |
| 403 | `binding_mismatch` | `checkout_id` がトークン発行時と一致しない |
| 404 | `token_not_found` | トークンが存在しない（未発行または使用済み） |
| 410 | `token_expired` | トークンの有効期限（30 分）が切れた |
| 502 | `stripe_error` | Stripe API エラー |
