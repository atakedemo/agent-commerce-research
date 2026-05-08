# MCP ツール設計（`b-mcp-server`）

本書は、HTTP の Store / Admin API（`[api-reference.md](api-reference.md)` のセクション 1〜4）とは別系統で、[Model Context Protocol](https://modelcontextprotocol.io/) の **Tools** としてエージェントから呼び出すインターフェースをまとめる。

実装: `[b-mcp-server/src/server.js](../b-mcp-server/src/server.js)`（stdio）。

- **規格対応**: UCP Shopping の [mcp.openrpc.json](https://github.com/Universal-Commerce-Protocol/ucp/blob/main/source/services/shopping/mcp.openrpc.json) に沿ったメソッド名。ミラー: `[references/ucp-shopping-mcp.openrpc.json](../references/ucp-shopping-mcp.openrpc.json)`。OpenRPC には **カタログ・カート・チェックアウト**が **同一ファイル**として定義されている。
- **単一 MCP endpoint（前提）**: マーチャントあたり、`/.well-known/ucp` の `services["dev.ucp.shopping"]` で宣言される **MCP 用 URL は 1 つ**。エージェントは **同一接続**の `tools/call` で Tool 名を切り替える（カタログ用・カート用に **別 MCP を立てる前提ではない**）。全体の流れは `[sequence.md](sequence.md)` を参照。
- **カタログ（規格・商品検索・詳細）**: [Catalog（概要）](../../../references/specification/community/ucp/docs/specification/catalog/index.md)、[Catalog — MCP](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md)。MCP 上は `search_catalog`（検索）、`get_product` / `lookup_catalog`（詳細・識別子解決）。
- **カート（規格・追加含む）**: [cart.md](../../../references/specification/community/ucp/docs/specification/cart.md)、[cart-rest.md](../../../references/specification/community/ucp/docs/specification/cart-rest.md)、[cart-mcp.md](../../../references/specification/community/ucp/docs/specification/cart-mcp.md)。**「カートへ追加」**は `create_cart` 時の `line_items`、または [Update Cart](../../../references/specification/community/ucp/docs/specification/cart.md#update-cart) のとおり `get_cart` で現状態を取得 → 行をマージ → `update_cart` でカート全体を置換（差分 PATCH ではない）。
- **トランスポート**: MCP（JSON-RPC over stdio）。クライアントの MCP 設定で `node .../b-mcp-server/src/server.js` 等を指定する。
- **状態**: チェックアウトはプロセス内メモリ保持。プロセス再起動で失われる。
- **既存 EC との連携**: 環境変数 `EC_BACKEND_URL`（例: `http://localhost:9000`）と `EC_PUBLISHABLE_KEY`（`pk_...`）が設定されている場合、全 12 Tool が **Medusa Store API 優先・インメモリモックフォールバック**の二層方式で動作する。`b-mcp-server/src/medusa.js` が API クライアント層を担い、Medusa 非接続時（未設定・エラー）は自動的にインメモリモックへ切り替わる。モックのみで動作させる場合は `b2-mcp-server-mock/`（Medusa 連携前のスナップショット）を参照。

---

## 1. 共通入力（`meta`）

全ツールで `meta` が必須。UCP OpenRPC の `meta` に相当。


| フィールド             | 必須  | 内容                                                         |
| ----------------- | --- | ---------------------------------------------------------- |
| `ucp-agent`       | ○   | オブジェクト。`profile` にエージェントの UCP プロファイル URL（`format: uri`）    |
| `idempotency-key` | △   | UUID 文字列。`complete_checkout` / `cancel_checkout` では **必須** |
| `signature`       | 任意  | 規格上の detached JWS 等。本デモでは検証のみ未実装                           |


追加キーは `meta` 上に載せてもよい（スキーマは passthrough）。

**呼び出しの形（共通）**: クライアントは MCP の `tools/call` で `params.name` に Tool 名、`params.arguments` に下記の JSON オブジェクトを渡す。本レスポンス例は、SDK が返す `CallToolResult` の `content[0].text` に入る JSON 文字列を整形したもの（`isError: true` のときも同様にテキスト本文を参照）。

---

## 2. MCP Tool と `[api-reference.md](api-reference.md)`（HTTP API）の対応一覧

UCP の各 Tool を本デモの Medusa（`[api-reference.md](api-reference.md)` **§3 ストア（Store）API**）に載せ替える際の **主な対応関係**である。実装は `b-mcp-server` が **チェックアウト系 5 Tool のみ**インメモリ実装のため、カタログ・カートの各行は **規格 OpenRPC とアダプタ設計用**の整理。認証・会員・注文閲覧は必要に応じ **§2 認証**、**§3** の `GET /store/orders` 等も併用する。

**補足（Medusa と UCP の差）**: UCP の `update_cart` は **カート全体の置換**（[cart.md#update-cart](../../../references/specification/community/ucp/docs/specification/cart.md#update-cart)）。Medusa は `POST /store/carts/{id}/line-items` 等で部分操作するため、アダプタで **取得→マージ→Store 上の複数 API** へ分解するか、内部で UCP 形のフルカートを保持するかを切り分ける。

### 2.1 カタログ（規格上の MCP Tool）

商品検索・商品詳細閲覧。仕様: [catalog/index.md](../../../references/specification/community/ucp/docs/specification/catalog/index.md)、[catalog/mcp.md](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md)。


| MCP Tool         | 用途       | 紐づける主な Store API（`api-reference.md` §3）                                                     | 備考                                                                                                                                        |
| ---------------- | -------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `search_catalog` | 商品検索     | `GET /store/products`（`q`、`category_id`、`limit`、`offset` 等）                                 | フィルタ・ページネーションは [Catalog Search](../../../references/specification/community/ucp/docs/specification/catalog/search.md) と Medusa のクエリを対応付け。 |
| `lookup_catalog` | 識別子バッチ解決 | `GET /store/products`/ `GET /store/products/{id}``GET /store/product-variants/{id}` 等を複数回 | バッチ API が無い場合はアダプタで直列化。[Lookup](../../../references/specification/community/ucp/docs/specification/catalog/lookup.md)。                    |
| `get_product`    | 商品詳細閲覧   | `GET /store/products/{id}`（`fields`・`expand`）必要に応じてバリアント                                   | [catalog/mcp.md#get_product](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md#get_product)。              |


### 2.2 カート（規格上の MCP Tool）

カート作成・取得・更新（追加含む）・取消。仕様: [cart.md](../../../references/specification/community/ucp/docs/specification/cart.md)、REST 束縛 [cart-rest.md](../../../references/specification/community/ucp/docs/specification/cart-rest.md)、MCP 束縛 [cart-mcp.md](../../../references/specification/community/ucp/docs/specification/cart-mcp.md)。


| MCP Tool      | 用途                  | 紐づける主な Store API（`api-reference.md` §3）                                                                  | 備考                                                                                                                                                                      |
| ------------- | ------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_cart` | 新規カート（初回から明細可）      | `POST /store/carts`、ラインは `POST /store/carts/{id}/line-items` 等                                           | [Create Cart](../../../references/specification/community/ucp/docs/specification/cart.md#create-cart)。`cart.line_items` を **一括**載せる場合はアダプタでカート作成後に line-items 追加へ展開しうる。 |
| `get_cart`    | スナップショット取得          | `GET /store/carts/{id}`                                                                                  | [Get Cart](../../../references/specification/community/ucp/docs/specification/cart.md#get-cart)。**追加前**のマージ元。                                                           |
| `update_cart` | 行の追加・数量変更（**全体置換**） | 実装次第: `GET` 後に `POST` …/line-items、`DELETE` …/line-items/{line_id}、`POST` …/line-items（update quantity）等 | [Update Cart](../../../references/specification/community/ucp/docs/specification/cart.md#update-cart)。UCP 意味では **送った `cart` が新状態の全体**。                                  |
| `cancel_cart` | カート終了               | （§3 に UCP 専用 cancel の一対一が無いことが多い）                                                                        | [Cancel Cart](../../../references/specification/community/ucp/docs/specification/cart.md#cancel-cart)。運用・カスタムルートで方針を決める。                                                |


### 2.3 チェックアウト（本デモ `b-mcp-server` 実装）


| MCP Tool            | 紐づける主な Store API（`api-reference.md` §3）                                                                                                                                                                                                                                                                                                                         | 備考                                                                                                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_checkout`   | `POST /store/carts`                                                                                                                                                                                                                                                                                                                                             | 現行 `b-mcp-server` が環境変数有効時に **ここだけ** HTTP 呼び出し。`region_id` 確定には **§3** `GET /store/regions` 等が前段になりうる。`cart_id` で UCP カートから引き継ぐ場合は [cart-to-checkout](../../../references/specification/community/ucp/docs/specification/cart.md#cart-to-checkout-conversion)。 |
| `get_checkout`      | `GET /store/carts/{id}`                                                                                                                                                                                                                                                                                                                                         | 読み取りスナップショット。`fields`・`expand` は [Medusa Store API](https://docs.medusajs.com/api/store) 慣例に従う。                                                                                                                                                                |
| `update_checkout`   | `POST /store/carts/{id}`*必要に応じて`POST /store/carts/{id}/line-items``POST`・`DELETE` `/store/carts/{id}/line-items/{line_id}``POST /store/carts/{id}/shipping-methods``GET /store/shipping-options`（`cart_id`）`POST /store/shipping-options/{id}/calculate``POST /store/payment-collections``POST /store/payment-collections/{id}/payment-sessions` | 「checkout 一括更新」は Medusa では **複数 HTTP** に分解しうる。差分に応じアダプタで振り分け。                                                                                                                                                                                                  |
| `complete_checkout` | `POST /store/carts/{id}/complete`                                                                                                                                                                                                                                                                                                                               | 顧客紐づけは **§3** `POST /store/carts/{id}/customer`。決済は payment-collections / payment-sessions（**§3**）を先行しうる。                                                                                                                                                      |
| `cancel_checkout`   | （**§3 にチェックアウト専用の取消ルートは記載なし**）                                                                                                                                                                                                                                                                                                                                  | 運用・カスタムルートで方針を決める。現デモは MCP 上の状態のみ `canceled`。                                                                                                                                                                                                                  |


**管理系・その他**: Admin API は **api-reference.md §4**（通常エージェント向け MCP とは別系統）。一覧は **§2.1**（カタログ）・**§2.2**（カート）。**各 Tool の詳細**はカタログ・カート **§3〜§8**、チェックアウト **§9〜§13**。

---

以下、**§2.1 / §2.2** に一覧したカタログ・カート系 Tool を、`create_checkout` と同じ形式（説明・入力・応答・`api-reference.md` 対応・`arguments`／応答例）で記載する。`meta` は **§1** を参照。スキーマの正は [ucp-shopping-mcp.openrpc.json](../references/ucp-shopping-mcp.openrpc.json) と [catalog/mcp.md](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md)、[cart-mcp.md](../../../references/specification/community/ucp/docs/specification/cart-mcp.md)、各能力の仕様ページ。

## 3. Tool `search_catalog`

| 項目 | 内容 |
| --- | --- |
| 説明 | カタログを検索する（OpenRPC: `search_catalog`）。キーワード、フィルタ、ページネーション等。[Catalog Search](../../../references/specification/community/ucp/docs/specification/catalog/search.md)。 |
| 入力 | `meta`（**必須**。`ucp-agent.profile` 必須）、`catalog`（**必須**。少なくとも `query` / `filters` / 拡張入力のいずれかを満たす想定の検索リクエスト。`context`・`pagination` 等は任意） |
| 応答 | `search_response` に相当するペイロード（例: 能力ネゴシエーション用の `ucp`、`products[]`、`pagination`）。業務エラー時は error 型になりうる。 |
| **api-reference.md との対応** | **§3** `GET /store/products`（`q`、`category_id`、`limit`、`offset` 等）を中核に、フィルタをクエリへ対応付け。 |

**リクエスト例**（`tools/call` の `arguments`）

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "catalog": {
    "query": "blue running shoes",
    "context": {
      "address_country": "US",
      "address_region": "CA",
      "intent": "comfortable everyday shoes"
    },
    "filters": {
      "categories": ["Footwear"],
      "price": { "max": 15000 }
    },
    "pagination": { "limit": 20 }
  }
}
```

**レスポンス例**（成功時の本文イメージ。**structuredContent** または MCP 実装が返す JSON の要点のみ抜粋）

```json
{
  "ucp": {
    "version": "2026-01-15",
    "capabilities": {
      "dev.ucp.shopping.catalog.search": [{ "version": "2026-01-15" }]
    }
  },
  "products": [
    {
      "id": "prod_abc123",
      "title": "Blue Runner Pro",
      "variants": [
        {
          "id": "prod_abc123_size10",
          "price": { "amount": 12000, "currency": "USD" },
          "availability": { "available": true }
        }
      ]
    }
  ],
  "pagination": {
    "cursor": "eyJwYWdlIjoxfQ==",
    "has_next_page": true,
    "total_count": 47
  }
}
```

---

## 4. Tool `get_product`

| 項目 | 内容 |
| --- | --- |
| 説明 | 識別子で **商品詳細**を取得する（OpenRPC: `get_product`）。オプション選択の提示・バリアント解決に利用。[Lookup — get_product](../../../references/specification/community/ucp/docs/specification/catalog/lookup.md)。 |
| 入力 | `meta`（**必須**）、`catalog`（**必須**。少なくとも対象 `id`。`selected` で既に選んだオプション、`preferences` で提示優先、`context` は任意） |
| 応答 | `get_product_response` に相当（例: `product` オブジェクトに `options`・`variants`・`selected` 等）。 |
| **api-reference.md との対応** | **§3** `GET /store/products/{id}`（`fields`・`expand`）。実装はバリアント展開を別リクエストに分岐しうる。 |

**リクエスト例**（`tools/call` の `arguments`）

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "catalog": {
    "id": "prod_abc123",
    "selected": [{ "name": "Color", "label": "Blue" }],
    "preferences": ["Color", "Size"],
    "context": { "address_country": "US" }
  }
}
```

**レスポンス例**（抜粋）

```json
{
  "ucp": {
    "version": "2026-01-15",
    "capabilities": {
      "dev.ucp.shopping.catalog.lookup": [{ "version": "2026-01-15" }]
    }
  },
  "product": {
    "id": "prod_abc123",
    "title": "Runner Pro",
    "options": [
      { "name": "Color", "values": [{ "label": "Blue", "available": true }] },
      { "name": "Size", "values": [{ "label": "10", "available": true }] }
    ],
    "variants": [
      {
        "id": "prod_abc123_blu_10",
        "price": { "amount": 12000, "currency": "USD" },
        "options": [
          { "name": "Color", "label": "Blue" },
          { "name": "Size", "label": "10" }
        ]
      }
    ]
  }
}
```

---

## 5. Tool `lookup_catalog`

| 項目 | 内容 |
| --- | --- |
| 説明 | **複数の**商品／バリアント識別子を一度に解決する（OpenRPC: `lookup_catalog`）。[Catalog Lookup](../../../references/specification/community/ucp/docs/specification/catalog/lookup.md)。 |
| 入力 | `meta`（**必須**）、`catalog`（**必須**。`ids` 配列と任意の `context` 等） |
| 応答 | `lookup_response` に相当（例: 能力宣言の `ucp`、解決済み **`products[]`** 等。[catalog/mcp.md#lookup_catalog](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md#lookup_catalog)）。 |
| **api-reference.md との対応** | **§3** `GET /store/products`、`GET /store/products/{id}`、`GET /store/product-variants/{id}` 等を **アダプタが複数回**呼び出す想定。 |

**リクエスト例**（`tools/call` の `arguments`）

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "catalog": {
    "ids": ["prod_abc123", "var_xyz789"],
    "context": { "address_country": "US" }
  }
}
```

**レスポンス例**（成功時は **`products[]`** 等、抜粋。厳密な形は [catalog/mcp.md#lookup_catalog](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md#lookup_catalog) および [lookup.md](../../../references/specification/community/ucp/docs/specification/catalog/lookup.md)）

```json
{
  "ucp": {
    "version": "2026-01-15",
    "capabilities": {
      "dev.ucp.shopping.catalog.lookup": [{ "version": "2026-01-15" }]
    }
  },
  "products": [
    {
      "id": "prod_abc123",
      "title": "Blue Runner Pro",
      "variants": [{ "id": "prod_abc123_size10", "price": { "amount": 12000, "currency": "USD" } }]
    }
  ]
}
```

---

## 6. Tool `create_cart`

| 項目 | 内容 |
| --- | --- |
| 説明 | **新規**カートセッションを作成する（OpenRPC: `create_cart`）。[Create Cart](../../../references/specification/community/ucp/docs/specification/cart.md#create-cart)、[cart-mcp.md#create_cart](../../../references/specification/community/ucp/docs/specification/cart-mcp.md#create_cart)。 |
| 入力 | `meta`（**必須**）、`cart`（**必須**。`line_items[]`・`context`・`buyer` 等、スキーマは cart 能力に準拠。**リクエスト本文に `id` は含めない**） |
| 応答 | 作成済みカート（`cart.id`、`line_items`、見積 `totals`、`continue_url` 等）まわりは [cart-mcp.md](../../../references/specification/community/ucp/docs/specification/cart-mcp.md) の出力スキーマ。全商品在庫切れ等では **カート資源を作らず** error 応答になりうる（[cart.md](../../../references/specification/community/ucp/docs/specification/cart.md#create-cart)）。 |
| **api-reference.md との対応** | **§3** `POST /store/carts` に加え、`line_items` を **§3** `POST /store/carts/{id}/line-items` 等へ展開しうる。 |

**リクエスト例**（`tools/call` の `arguments`）

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "cart": {
    "line_items": [
      {
        "item": { "id": "item_123" },
        "quantity": 2
      }
    ],
    "context": {
      "address_country": "US",
      "address_region": "CA",
      "postal_code": "94105"
    }
  }
}
```

**レスポンス例**（成功・抜粋）

```json
{
  "ucp": {
    "version": "2026-01-15",
    "capabilities": {
      "dev.ucp.shopping.cart": [{ "version": "2026-01-15" }]
    }
  },
  "id": "cart_abc123",
  "line_items": [
    {
      "id": "li_1",
      "item": { "id": "item_123", "title": "Red T-Shirt", "price": 2500 },
      "quantity": 2,
      "totals": [{ "type": "subtotal", "amount": 5000 }, { "type": "total", "amount": 5000 }]
    }
  ],
  "currency": "USD",
  "totals": [{ "type": "subtotal", "amount": 5000 }, { "type": "total", "amount": 5000 }],
  "continue_url": "https://merchant.example.com/checkout?cart=cart_abc123"
}
```

---

## 7. Tool `get_cart`

| 項目 | 内容 |
| --- | --- |
| 説明 | 既存カートを **取得**する（OpenRPC: `get_cart`）。[Get Cart](../../../references/specification/community/ucp/docs/specification/cart.md#get-cart)。 |
| 入力 | `meta`（**必須**）、`id`（**必須**。カートセッション ID。**ペイロード内の `cart` に `id` を書かない**） |
| 応答 | カートの現在スナップショット。期限切れ・取消後は `not_found` など error になりうる。 |
| **api-reference.md との対応** | **§3** `GET /store/carts/{id}`。`update_cart` で行を足す前の **マージの土台**。 |

**リクエスト例**（`tools/call` の `arguments`）

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "id": "cart_abc123"
}
```

**レスポンス例**（成功・抜粋）

```json
{
  "id": "cart_abc123",
  "line_items": [
    {
      "id": "li_1",
      "item": { "id": "item_123", "title": "Red T-Shirt", "price": 2500 },
      "quantity": 2,
      "totals": [{ "type": "subtotal", "amount": 5000 }]
    }
  ],
  "currency": "USD",
  "totals": [{ "type": "subtotal", "amount": 5000 }, { "type": "total", "amount": 5000 }]
}
```

---

## 8. Tool `update_cart`

| 項目 | 内容 |
| --- | --- |
| 説明 | 既存カートを **更新**する（OpenRPC: `update_cart`）。規格上はカート全体の **置換**（送った `cart` が新しい全体状態）。[Update Cart](../../../references/specification/community/ucp/docs/specification/cart.md#update-cart)、[cart-mcp.md#update_cart](../../../references/specification/community/ucp/docs/specification/cart-mcp.md#update_cart)。 |
| 入力 | `meta`（**必須**）、`id`（**必須**）、`cart`（**必須**。**`cart` オブジェクト内に `id` を含めない**） |
| 応答 | 更新後のカート全体。 |
| **api-reference.md との対応** | Medusa では **§3** `GET /store/carts/{id}` の後に `POST`／`DELETE` `.../line-items` 等へ分解しうる（[mcp-reference.md](mcp-reference.md) §2.2 参照）。 |

**リクエスト例**（`tools/call` の `arguments`。行を足した **全体**を渡す）

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "id": "cart_abc123",
  "cart": {
    "line_items": [
      {
        "item": { "id": "item_123" },
        "quantity": 3
      },
      {
        "item": { "id": "item_456" },
        "quantity": 1
      }
    ],
    "context": {
      "address_country": "US",
      "address_region": "CA",
      "postal_code": "94105"
    }
  }
}
```

**レスポンス例**（成功・抜粋）

```json
{
  "id": "cart_abc123",
  "line_items": [
    {
      "id": "li_1",
      "item": { "id": "item_123", "title": "Red T-Shirt", "price": 2500 },
      "quantity": 3
    },
    {
      "id": "li_2",
      "item": { "id": "item_456", "title": "Blue Mug", "price": 1200 },
      "quantity": 1
    }
  ],
  "currency": "USD",
  "totals": [{ "type": "subtotal", "amount": 8700 }, { "type": "total", "amount": 8700 }]
}
```

---

## 9. Tool `create_checkout`


| 項目                        | 内容                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 説明                        | 新規チェックアウトセッションを作成する（OpenRPC: `create_checkout`）。                                                                     |
| 入力                        | `meta`（上表）、`checkout`（オブジェクト。キー構造は規格スキーマに準拠して拡張。実装は `z.record` で緩い）                                                  |
| 応答                        | `id`（`co_<uuid>` 形式）、`status`（初期は `incomplete`）、`ucp_meta`、`checkout`（入力の `checkout` をそのまま格納。Medusa 連携時は内部で Medusa カートも作成）                |
| **api-reference.md との対応** | **§3** `POST /store/carts` を中核。前段として **§3** `GET /store/regions`（`region_id`）や **§3** `GET /store/products` 等を参照しうる。 |


**リクエスト例**（`tools/call` の `arguments`）

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    },
    "idempotency-key": "11111111-1111-4111-8111-111111111111"
  },
  "checkout": {
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }]
  }
}
```

**レスポンス例**（成功時）

```json
{
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab",
  "status": "incomplete",
  "ucp_meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    },
    "idempotency-key": "11111111-1111-4111-8111-111111111111"
  },
  "checkout": {
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }]
  }
}
```

---

## 10. Tool `get_checkout`


| 項目                        | 内容                                                                            |
| ------------------------- | ----------------------------------------------------------------------------- |
| 説明                        | ID でチェックアウトを取得する（OpenRPC: `get_checkout`）。                                    |
| 入力                        | `meta`、`id`（文字列）                                                              |
| 応答                        | 該当レコードの JSON。未存在時はツールエラー（`checkout_not_found`）。                               |
| **api-reference.md との対応** | **§3** `GET /store/carts/{id}`。MCP の `id` と Medusa `cart_id` の対応表をアダプタ側で保持する。 |


**リクエスト例**

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab"
}
```

**レスポンス例**（成功。実データは直前の create/update を反映）

```json
{
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab",
  "status": "incomplete",
  "ucp_meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "checkout": {
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }]
  }
}
```

**レスポンス例**（失敗・`isError: true`。本文は次の JSON の文字列）

```json
{
  "error": "checkout_not_found",
  "id": "co_00000000-0000-4000-8000-000000000000"
}
```

---

## 11. Tool `update_checkout`


| 項目                        | 内容                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 説明                        | チェックアウト本文をマージ更新する（OpenRPC: `update_checkout`）。                                                                                                                                                                                                                                                                                                                                |
| 入力                        | `meta`、`id`、`checkout`（差分オブジェクト。既存 `checkout` にシャローマージ）                                                                                                                                                                                                                                                                                                                       |
| 応答                        | 更新後レコード。`status` は既に `completed` でなければ `ready_for_complete`。                                                                                                                                                                                                                                                                                                                  |
| **api-reference.md との対応** | **§3** のカート更新系に分解: `POST /store/carts/{id}`（送付先・メール等）、`POST /store/carts/{id}/line-items` および `POST`・`DELETE` `.../line-items/{line_id}`（明細）、`POST /store/carts/{id}/shipping-methods`、`GET /store/shipping-options`、`POST /store/shipping-options/{id}/calculate`、`POST /store/payment-collections` と `POST /store/payment-collections/{id}/payment-sessions`。変更差分に応じて呼び分ける。 |


**リクエスト例**

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab",
  "checkout": {
    "email": "shopper@example.com",
    "shipping_address": {
      "first_name": "A",
      "last_name": "B",
      "address_1": "1 Main St",
      "city": "Copenhagen",
      "country_code": "dk",
      "postal_code": "2100"
    }
  }
}
```

**レスポンス例**（成功）

```json
{
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab",
  "status": "ready_for_complete",
  "ucp_meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    }
  },
  "checkout": {
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }],
    "email": "shopper@example.com",
    "shipping_address": {
      "first_name": "A",
      "last_name": "B",
      "address_1": "1 Main St",
      "city": "Copenhagen",
      "country_code": "dk",
      "postal_code": "2100"
    }
  }
}
```

※ 既に `status` が `completed` のレコードを更新した場合、`status` は `completed` のまま。

**レスポンス例**（失敗・該当 ID なし）

```json
{
  "error": "checkout_not_found",
  "id": "co_00000000-0000-4000-8000-000000000000"
}
```

---

## 12. Tool `complete_checkout`


| 項目                        | 内容                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 説明                        | チェックアウトを完了状態にする（OpenRPC: `complete_checkout`）。**注文確定・決済の Medusa 呼び出しは未実装**（デモ用状態遷移のみ）。                                                                                    |
| 入力                        | `meta`（`idempotency-key` **必須**）、`id`、`checkout`（完了時にマージするオブジェクト）                                                                                                         |
| 応答                        | `status: "completed"` のレコード。                                                                                                                                              |
| **api-reference.md との対応** | **§3** `POST /store/carts/{id}/complete`。ログイン顧客に紐づける場合は同 **§3** `POST /store/carts/{id}/customer`、決済フローは payment-collections / payment-sessions（**§3** 記載）を先行完了させる想定が一般的。 |


**リクエスト例**

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    },
    "idempotency-key": "22222222-2222-4222-8222-222222222222"
  },
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab",
  "checkout": {
    "payment_reference": "demo_pending"
  }
}
```

**レスポンス例**（成功）

```json
{
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab",
  "status": "completed",
  "ucp_meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    },
    "idempotency-key": "22222222-2222-4222-8222-222222222222"
  },
  "checkout": {
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }],
    "email": "shopper@example.com",
    "payment_reference": "demo_pending"
  }
}
```

※ 実装は `checkout` を前状態とマージするため、上表は例示。**該当 `id` のセッションが無い**場合は `checkout_not_found`。`meta.idempotency-key` が無いとスキーマ検証でエラーとなる。

**レスポンス例**（失敗・該当 ID なし）

```json
{
  "error": "checkout_not_found",
  "id": "co_00000000-0000-4000-8000-000000000000"
}
```

---

## 13. Tool `cancel_checkout`


| 項目                        | 内容                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 説明                        | チェックアウトを取消す（OpenRPC: `cancel_checkout`）。                                                                       |
| 入力                        | `meta`（`idempotency-key` **必須**）、`id`                                                                          |
| 応答                        | `status: "canceled"` のレコード。                                                                                    |
| **api-reference.md との対応** | `api-reference.md` §3 に相当する「取消」専用ルートは無い。実装ではインメモリ状態のみ `canceled` にする。Medusa 連携時はカート破棄方針・カスタム Store ルート等を別途決める。 |


**リクエスト例**

```json
{
  "meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    },
    "idempotency-key": "33333333-3333-4333-8333-333333333333"
  },
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab"
}
```

**レスポンス例**（成功）

```json
{
  "id": "co_3f7c8e2a-9d1b-40e0-a7b4-0123456789ab",
  "status": "canceled",
  "ucp_meta": {
    "ucp-agent": {
      "profile": "https://agent.example/.well-known/ucp"
    },
    "idempotency-key": "33333333-3333-4333-8333-333333333333"
  },
  "checkout": {
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }]
  }
}
```

**レスポンス例**（未存在 ID・エラー時）

```json
{
  "error": "checkout_not_found",
  "id": "co_00000000-0000-4000-8000-000000000000"
}
```

---

## 14. 起動例（開発用）

**Medusa 連携モード**（`EC_BACKEND_URL` + `EC_PUBLISHABLE_KEY` を設定すると全 12 Tool が Medusa 優先・モックフォールバックで動作）

```bash
cd b-mcp-server
npm install
export EC_BACKEND_URL=http://localhost:9000
export EC_PUBLISHABLE_KEY=pk_...
npm start
```

**モックのみモード**（Medusa 不要。Medusa 連携前のスナップショット）

```bash
cd b2-mcp-server-mock
npm install
npm start
```

---

## 補足

- **MCP Tool と Medusa Store HTTP の対応**は **§2**（一覧）および、各 Tool 節（カタログ・カート **§3〜§8**、チェックアウト **§9〜§13**）の **api-reference.md との対応**行を参照。
- 機械可読なメソッド定義は `references/ucp-shopping-mcp.openrpc.json`（および UCP 本家 OpenRPC）を正とする。**規格にはカタログ・カート・チェックアウトが同一 OpenRPC に含まれる**。本デモの実行コード（`b-mcp-server`）は **カタログ・カート・チェックアウト 計 12 Tool** をすべて実装し、Medusa 連携とインメモリモックの二層方式で動作する。
- シーケンス・単一 MCP endpoint の前提は `[sequence.md](sequence.md)` を参照。カタログ・カート系 Tool の **項目表・arguments/responses 例**は本書 **§3〜§8**、チェックアウト系は **§9〜§13**。

