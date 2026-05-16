# バックエンド API 一覧

対象: `apps/backend`（Medusa 2.14）。開発時の既定ベース URL は `http://localhost:9000` を想定する。

- **OpenAPI 3.0（本書の HTTP API）**: 同ディレクトリの [`openapi.yaml`](openapi.yaml)（MCP Tools は含まない）。

- **本リポジトリ独自実装**は `src/api` 配下のファイルルートのみ（2 本）。
- **その他**は Medusa コアの Store / Admin / Auth API として同一プロセスで公開される。フルスキーマは [Store API](https://docs.medusajs.com/api/store)・[Admin API](https://docs.medusajs.com/api/admin) を参照のこと。以下の「**ストア系（本デモ利用）**」は、`@medusajs/js-sdk@2.14.0` が実際に使用する HTTP メソッドとパスに合わせた。
- **MCP Tools（`b-mcp-server`）** は HTTP の対象外。[**`mcp-reference.md`**](mcp-reference.md) に設計・ツール一覧を切り出した（UCP Shopping OpenRPC のチェックアウト系メソッド名に対応）。

## 共通ヘッダ

| 目的 | ヘッダ名 | 例 |
|------|----------|-----|
| 店舗用公開キー | `x-publishable-api-key` | Admin の Settings で発行した `pk_...` |
| ログイン顧客 | `Authorization` | `Bearer <JWT>` |
| 取り扱いロケール | `x-medusa-locale` | ストアフロント拡張で付与可 |

`curl` 例では `export PK=pk_...` と `export BASE=http://localhost:9000` がある想定。

---

## 1. 本リポジトリのカスタム API

実装: `src/api/.../route.ts`。Medusa 既定の CORS 設定の対象になる。

### `GET` `/store/custom`

| 項目 | 内容 |
|------|------|
| 説明 | 疎通用プレースホルダ。本文なしで HTTP 200 を返す。 |

**リクエスト例**

```bash
curl -sS -D - -o /dev/null \
  -H "x-publishable-api-key: $PK" \
  "$BASE/store/custom"
```

**レスポンス例**

```http
HTTP/1.1 200 OK
```

（ボディなし: `res.sendStatus(200)`）

---

### `GET` `/admin/custom`

| 項目 | 内容 |
|------|------|
| 説明 | 管理向け疎通用プレースホルダ。本文なしで HTTP 200。 |

**リクエスト例**

```bash
# Admin ルートは通常 Authorization が必要。環境に合わせて付与のこと。
curl -sS -D - -o /dev/null \
  -H "Authorization: Bearer $ADMIN_JWT" \
  "$BASE/admin/custom"
```

**レスポンス例**

```http
HTTP/1.1 200 OK
```

（ボディなし）

---

## 2. 認証（Auth）API

`apps/storefront` の会員登録・ログアウト等で使用。パスは `@medusajs/js-sdk` の `dist/auth/index.js` に準拠。

### `POST` `/auth/customer/emailpass/register`

| 項目 | 内容 |
|------|------|
| 説明 | 会員登録用の一時トークン取得。続けて `POST /store/customers` で会員を作成。 |

**リクエスト例**

```bash
curl -sS -X POST "$BASE/auth/customer/emailpass/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"supersecret"}'
```

**レスポンス例**

```json
{
  "token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `POST` `/auth/customer/emailpass`

| 項目 | 内容 |
|------|------|
| 説明 | メール/パスワードでログイン。JWT または外部認証用 `location` を返す。 |

**リクエスト例**

```bash
curl -sS -X POST "$BASE/auth/customer/emailpass" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"supersecret"}'
```

**レスポンス例（JWT ログイン成功）**

```json
{
  "token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**レスポンス例（OAuth 等でリダイレクトが必要な場合）**

```json
{
  "location": "https://provider.example/authorize?..."
}
```

---

### `DELETE` `/auth/session`

| 項目 | 内容 |
|------|------|
| 説明 | JS SDK の `auth.type` が `session` のとき、ログアウトでセッション削除に使用。 |

**リクエスト例**

```bash
curl -sS -X DELETE "$BASE/auth/session" \
  -H "Cookie: connect.sid=..."
```

**レスポンス例**

```http
HTTP/1.1 200 OK
```

（本文は空または実装に依存）

---

## 3. ストア（Store）API — 本デモ利用ルート

以下は DTC ストアフロント `apps/storefront` から呼び出している、または同スターター群で一般的なパスである（SDK: `node_modules/@medusajs/js-sdk/dist/store/index.js`）。

### `GET` `/store/regions`

**リクエスト例**

```bash
curl -sS -H "x-publishable-api-key: $PK" \
  "$BASE/store/regions"
```

**レスポンス例**

```json
{
  "regions": [
    {
      "id": "reg_01HQXYZ...",
      "name": "Europe",
      "currency_code": "eur",
      "countries": [{ "iso_2": "dk", "display_name": "Denmark" }]
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 50
}
```

---

### `GET` `/store/regions/{id}`

**リクエスト例**

```bash
curl -sS -H "x-publishable-api-key: $PK" \
  "$BASE/store/regions/reg_01HQXYZ..."
```

**レスポンス例**

```json
{
  "region": {
    "id": "reg_01HQXYZ...",
    "name": "Europe",
    "currency_code": "eur"
  }
}
```

---

### `GET` `/store/locales`

**リクエスト例**

```bash
curl -sS -H "x-publishable-api-key: $PK" \
  "$BASE/store/locales"
```

**レスポンス例**

```json
{
  "locales": [
    { "code": "en", "name": "English" }
  ]
}
```

---

### `GET` `/store/products`

**リクエスト例**（`region_id` 必須に近い）

```bash
curl -sS -G -H "x-publishable-api-key: $PK" \
  --data-urlencode "region_id=reg_01HQXYZ" \
  --data-urlencode "limit=12" \
  --data-urlencode "offset=0" \
  "$BASE/store/products"
```

**レスポンス例**

```json
{
  "products": [
    {
      "id": "prod_01...",
      "title": "Example",
      "handle": "example",
      "variants": [
        { "id": "variant_01...", "title": "Default" }
      ]
    }
  ],
  "count": 24,
  "offset": 0,
  "limit": 12
}
```

---

### `GET` `/store/product-variants/{id}`

**リクエスト例**

```bash
curl -sS -G -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  --data-urlencode "fields=*images" \
  "$BASE/store/product-variants/variant_01..."
```

**レスポンス例**

```json
{
  "variant": {
    "id": "variant_01...",
    "title": "Default",
    "sku": "EX-1"
  }
}
```

---

### `GET` `/store/collections` / `GET` `/store/collections/{id}`

**リクエスト例**

```bash
curl -sS -H "x-publishable-api-key: $PK" \
  "$BASE/store/collections?limit=10&offset=0"
```

**レスポンス例**

```json
{
  "collections": [
    { "id": "pcol_01...", "title": "New Arrivals", "handle": "new-arrivals" }
  ],
  "count": 1,
  "offset": 0,
  "limit": 10
}
```

---

### `GET` `/store/product-categories`

**リクエスト例**

```bash
curl -sS -G -H "x-publishable-api-key: $PK" \
  --data-urlencode "handle=clothing%2Fshirts" \
  --data-urlencode "limit=5" \
  "$BASE/store/product-categories"
```

**レスポンス例**

```json
{
  "product_categories": [
    {
      "id": "pcat_01...",
      "name": "Shirts",
      "handle": "clothing/shirts"
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 5
}
```

---

### `POST` `/store/carts`

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/carts" \
  -H "x-publishable-api-key: $PK" \
  -H "Content-Type: application/json" \
  -d '{"region_id":"reg_01...","email":"shopper@example.com","locale":"en"}'
```

**レスポンス例**

```json
{
  "cart": {
    "id": "cart_01...",
    "region_id": "reg_01...",
    "items": []
  }
}
```

---

### `GET` `/store/carts/{id}`

**リクエスト例**

```bash
curl -sS -G -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  --data-urlencode "fields=*,*items" \
  "$BASE/store/carts/cart_01..."
```

**レスポンス例**

```json
{
  "cart": {
    "id": "cart_01...",
    "items": [
      { "id": "item_01...", "title": "Example", "quantity": 1 }
    ]
  }
}
```

---

### `POST` `/store/carts/{id}`

（カート更新: 送付先・`promo_codes` 等）

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/carts/cart_01..." \
  -H "x-publishable-api-key: $PK" \
  -H "Content-Type: application/json" \
  -d '{"email":"shopper@example.com","shipping_address":{"first_name":"A","last_name":"B","address_1":"1 Main St","city":"Copenhagen","country_code":"dk","postal_code":"2100"}}'
```

**レスポンス例**

```json
{
  "cart": {
    "id": "cart_01...",
    "email": "shopper@example.com"
  }
}
```

---

### `POST` `/store/carts/{id}/line-items`

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/carts/cart_01.../line-items" \
  -H "x-publishable-api-key: $PK" \
  -H "Content-Type: application/json" \
  -d '{"variant_id":"variant_01...","quantity":1}'
```

**レスポンス例**

```json
{
  "cart": {
    "id": "cart_01...",
    "items": [
      { "id": "item_01...", "variant_id": "variant_01...", "quantity": 1 }
    ]
  }
}
```

---

### `POST` `/store/carts/{id}/line-items/{line_id}`

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/carts/cart_01.../line-items/item_01..." \
  -H "x-publishable-api-key: $PK" \
  -H "Content-Type: application/json" \
  -d '{"quantity":2}'
```

**レスポンス例**

```json
{
  "cart": {
    "id": "cart_01...",
    "items": [
      { "id": "item_01...", "quantity": 2 }
    ]
  }
}
```

---

### `DELETE` `/store/carts/{id}/line-items/{line_id}`

**リクエスト例**

```bash
curl -sS -X DELETE "$BASE/store/carts/cart_01.../line-items/item_01..." \
  -H "x-publishable-api-key: $PK"
```

**レスポンス例**

```json
{
  "id": "item_01...",
  "object": "line-item",
  "deleted": true
}
```

---

### `POST` `/store/carts/{id}/shipping-methods`

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/carts/cart_01.../shipping-methods" \
  -H "x-publishable-api-key: $PK" \
  -H "Content-Type: application/json" \
  -d '{"option_id":"so_01..."}'
```

**レスポンス例**

```json
{
  "cart": {
    "id": "cart_01...",
    "shipping_methods": [
      { "id": "sm_01...", "name": "Standard" }
    ]
  }
}
```

---

### `GET` `/store/shipping-options`（クエリ: `cart_id`）

**リクエスト例**

```bash
curl -sS -G -H "x-publishable-api-key: $PK" \
  --data-urlencode "cart_id=cart_01..." \
  "$BASE/store/shipping-options"
```

**レスポンス例**

```json
{
  "shipping_options": [
    { "id": "so_01...", "name": "Post Standard", "amount": 500 }
  ]
}
```

---

### `POST` `/store/shipping-options/{id}/calculate`

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/shipping-options/so_01.../calculate" \
  -H "x-publishable-api-key: $PK" \
  -H "Content-Type: application/json" \
  -d '{"cart_id":"cart_01..."}'
```

**レスポンス例**

```json
{
  "shipping_option": {
    "id": "so_01...",
    "name": "Post Standard",
    "calculated_price": 500
  }
}
```

---

### `GET` `/store/payment-providers`（クエリ: `region_id`）

**リクエスト例**

```bash
curl -sS -G -H "x-publishable-api-key: $PK" \
  --data-urlencode "region_id=reg_01..." \
  "$BASE/store/payment-providers"
```

**レスポンス例**

```json
{
  "payment_providers": [
    { "id": "pp_system_default", "is_enabled": true }
  ],
  "count": 1,
  "offset": 0,
  "limit": 20
}
```

---

### `POST` `/store/payment-collections` / `POST` `/store/payment-collections/{id}/payment-sessions`

カートに `payment_collection` が無い場合、SDK は先に `POST /store/payment-collections`（`{ "cart_id": "..." }`）を行い、続けて `payment-sessions` を初期化する。

**リクエスト例（セッション初期化）**

```bash
curl -sS -X POST \
  "$BASE/store/payment-collections/paycol_01.../payment-sessions" \
  -H "x-publishable-api-key: $PK" \
  -H "Content-Type: application/json" \
  -d '{"provider_id":"pp_system_default","data":{}}'
```

**レスポンス例**

```json
{
  "payment_collection": {
    "id": "paycol_01...",
    "status": "not_paid",
    "payment_sessions": [
      { "id": "pays_01...", "status": "pending" }
    ]
  }
}
```

---

### `POST` `/store/carts/{id}/complete`

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/carts/cart_01.../complete" \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT"
```

**レスポンス例（注文確定）**

```json
{
  "type": "order",
  "order": {
    "id": "order_01...",
    "status": "pending",
    "email": "shopper@example.com"
  }
}
```

**レスポンス例（エラー時はカート再編集: `type: "cart"` ）**

```json
{
  "type": "cart",
  "cart": { "id": "cart_01..." },
  "error": { "type": "invalid_data", "message": "..." }
}
```

---

### `POST` `/store/carts/{id}/customer`

| 項目 | 内容 |
|------|------|
| 説明 | 認証済み顧客にカートを紐づけ（`transferCart`）。 |

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/carts/cart_01.../customer" \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT"
```

**レスポンス例**

```json
{
  "cart": {
    "id": "cart_01...",
    "customer_id": "cus_01..."
  }
}
```

---

### `GET` `/store/orders` / `GET` `/store/orders/{id}`

**リクエスト例**

```bash
curl -sS -G \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  --data-urlencode "limit=10" \
  --data-urlencode "order=-created_at" \
  "$BASE/store/orders"
```

**レスポンス例**

```json
{
  "orders": [
    {
      "id": "order_01...",
      "status": "pending",
      "display_id": 1001
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 10
}
```

---

### 注文の受け渡し（Order transfer）

| メソッド | パス |
|----------|------|
| `POST` | `/store/orders/{id}/transfer/request` |
| `POST` | `/store/orders/{id}/transfer/cancel` |
| `POST` | `/store/orders/{id}/transfer/accept` |
| `POST` | `/store/orders/{id}/transfer/decline` |

**`POST` `/store/orders/{id}/transfer/request` リクエスト例**

```bash
curl -sS -X POST "$BASE/store/orders/order_01.../transfer/request" \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**レスポンス例**

```json
{
  "order": { "id": "order_01..." }
}
```

**`POST` `.../transfer/accept` リクエスト例**

```bash
curl -sS -X POST "$BASE/store/orders/order_01.../transfer/accept" \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"token":"transfer_..."}'
```

---

### 顧客 `POST` `/store/customers` / `GET` `/store/customers/me` / `POST` `/store/customers/me`

**`POST` `/store/customers`（会員登録直後: 登録用 JWT を付与）**

**リクエスト例**

```bash
curl -sS -X POST "$BASE/store/customers" \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $REGISTRATION_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","first_name":"A","last_name":"B"}'
```

**レスポンス例**

```json
{
  "customer": {
    "id": "cus_01...",
    "email": "u@example.com"
  }
}
```

**`GET` `/store/customers/me`**

```bash
curl -sS -G -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  --data-urlencode "fields=*orders" \
  "$BASE/store/customers/me"
```

**レスポンス例**

```json
{
  "customer": {
    "id": "cus_01...",
    "email": "u@example.com",
    "orders": []
  }
}
```

**`POST` `/store/customers/me`（プロフィール更新）**

```bash
curl -sS -X POST "$BASE/store/customers/me" \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Ann"}'
```

**レスポンス例**

```json
{
  "customer": {
    "id": "cus_01...",
    "first_name": "Ann"
  }
}
```

---

### 顧客住所 `/store/customers/me/addresses`

| メソッド | パス | 内容 |
|----------|------|------|
| `GET` | `/store/customers/me/addresses` | 一覧 |
| `GET` | `/store/customers/me/addresses/{addressId}` | 取得 |
| `POST` | `/store/customers/me/addresses` | 作成 |
| `POST` | `/store/customers/me/addresses/{addressId}` | 更新 |
| `DELETE` | `/store/customers/me/addresses/{addressId}` | 削除 |

**`POST` 作成 リクエスト例**

```bash
curl -sS -X POST "$BASE/store/customers/me/addresses" \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"A","last_name":"B","address_1":"1 St","city":"Cph","country_code":"dk","postal_code":"2100","is_default_shipping":true}'
```

**レスポンス例**

```json
{
  "customer": {
    "id": "cus_01...",
    "addresses": [
      { "id": "caddr_01...", "city": "Cph" }
    ]
  }
}
```

**`DELETE` リクエスト例**

```bash
curl -sS -X DELETE "$BASE/store/customers/me/addresses/caddr_01..." \
  -H "x-publishable-api-key: $PK" \
  -H "Authorization: Bearer $CUSTOMER_JWT"
```

**レスポンス例**

```json
{
  "id": "caddr_01...",
  "object": "address",
  "deleted": true,
  "parent": { "id": "cus_01..." }
}
```

---

## 4. Admin API（Medusa 標準）

本バックエンドは同じ `medusa` プロセス上で [Admin API](https://docs.medusajs.com/api/admin) 一式を提供する。商品・注文・在庫・リージョン等の管理用で、**管理者 JWT**（`user` スコープ）を要するルートが多い。

- **本リポジトリで追加した Admin カスタム**は、セクション 1「`GET` `/admin/custom`」の 1 本のみ。
- 汎用例: `GET /admin/products`（`Authorization: Bearer`）。

**リクエスト例**

```bash
curl -sS -G -H "Authorization: Bearer $ADMIN_JWT" \
  --data-urlencode "limit=5" \
  "$BASE/admin/products"
```

**レスポンス例（概念）**

```json
{
  "products": [{ "id": "prod_01...", "title": "Example" }],
  "count": 1,
  "offset": 0,
  "limit": 5
}
```

---

## MCP（エージェント / `b-mcp-server`）

Model Context Protocol 経由のツール定義・起動方法は **[`mcp-reference.md`](mcp-reference.md)** を参照（本書は Medusa HTTP API のみ対象）。

---

## 補足

- ID や金額の形は、シードと実データの状態に依存する。上記の `reg_...` 等はプレースホルダーである。
- `fields`・`expand` 等のクエリは [Select fields and relations](https://docs.medusajs.com/api/store#select-fields-and-relations) に従う。
