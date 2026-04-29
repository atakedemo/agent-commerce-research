# MCP ツール設計（`b-mcp-server`）

本書は、HTTP の Store / Admin API（`[api-reference.md](api-reference.md)` のセクション 1〜4）とは別系統で、[Model Context Protocol](https://modelcontextprotocol.io/) の **Tools** としてエージェントから呼び出すインターフェースをまとめる。

実装: `[b-mcp-server/src/server.js](../b-mcp-server/src/server.js)`（stdio）。

- **規格対応**: UCP Shopping の [mcp.openrpc.json](https://github.com/Universal-Commerce-Protocol/ucp/blob/main/source/services/shopping/mcp.openrpc.json) に沿ったメソッド名。ミラー: `[references/ucp-shopping-mcp.openrpc.json](../references/ucp-shopping-mcp.openrpc.json)`。
- **トランスポート**: MCP（JSON-RPC over stdio）。クライアントの MCP 設定で `node .../b-mcp-server/src/server.js` 等を指定する。
- **状態**: チェックアウトはプロセス内メモリ保持。プロセス再起動で失われる。
- **既存 EC との連携**: 環境変数 `EC_BACKEND_URL`（例: `http://localhost:9000`）と `EC_PUBLISHABLE_KEY`（`pk_...`）が両方あるとき、`create_checkout` 実行中に `[api-reference.md](api-reference.md)` の **3. ストア（Store）API** にある `POST` `/store/carts` と同等の呼び出しを試行し、応答を `checkout._ec_mirror` に格納する（空カート作成のみ。明細映射は未実装）。

---

## 1. 共通入力（`meta`）

全ツールで `meta` が必須。UCP OpenRPC の `meta` に相当。


| フィールド             | 必須  | 内容                                                         |
| ----------------- | --- | ---------------------------------------------------------- |
| `ucp-agent`       | ○   | オブジェクト。`profile` にエージェントの UCP プロファイル URL（`format: uri`）    |
| `idempotency-key` | △   | UUID 文字列。`complete_checkout` / `cancel_checkout` では **必須** |
| `signature`       | 任意  | 規格上の detached JWS 等。本デモでは検証のみ未実装                           |


追加キーは `meta` 上に載せてもよい（スキーマは passthrough）。

**呼び出しの形（共通）**: クライアントは MCP の `tools/call` で `params.name` に Tool 名、`params.arguments` に下記の JSON オブジェクトを渡す。本レスポンス例は、SDK が返す `CallToolResult` の `**content[0].text` に入る JSON 文字列**を整形したもの（`isError: true` のときも同様にテキスト本文を参照）。

---

## 2. MCP Tool と `[api-reference.md](api-reference.md)`（HTTP API）の対応一覧

UCP のチェックアウト Tool を本デモの Medusa（`[api-reference.md](api-reference.md)` **§3 ストア（Store）API**）に載せ替える際の **主な対応関係**である。実装は `b-mcp-server` がインメモリ中心のため、本一覧は **アダプタ設計・今後の拡張**を想定したマッピング。認証・会員・注文閲覧は必要に応じ **§2 認証**、**§3** の `GET /store/orders` 等も併用する。


| MCP Tool            | 紐づける主な Store API（`api-reference.md` §3）                                                                                                                                                                                                                                                                                                                   | 備考                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `create_checkout`   | `POST /store/carts`                                                                                                                                                                                                                                                                                                                                       | 現行 `b-mcp-server` が環境変数有効時に **ここだけ** HTTP 呼び出し。`region_id` 確定には **§3** `GET /store/regions` 等が前段になりうる。    |
| `get_checkout`      | `GET /store/carts/{id}`                                                                                                                                                                                                                                                                                                                                   | 読み取りスナップショット。`fields`・`expand` は [Medusa Store API](https://docs.medusajs.com/api/store) 慣例に従う。           |
| `update_checkout`   | `POST /store/carts/{id}`、*必要に応じて`POST /store/carts/{id}/line-items``POST`・`DELETE` `/store/carts/{id}/line-items/{line_id}``POST /store/carts/{id}/shipping-methods``GET /store/shipping-options`（`cart_id`）`POST /store/shipping-options/{id}/calculate``POST /store/payment-collections``POST /store/payment-collections/{id}/payment-sessions` | 「checkout 一括更新」は Medusa では **複数 HTTP** に分解しうる。差分に応じアダプタで振り分け。                                             |
| `complete_checkout` | `POST /store/carts/{id}/complete`                                                                                                                                                                                                                                                                                                                         | 顧客紐づけは **§3** `POST /store/carts/{id}/customer`。決済は payment-collections / payment-sessions（**§3**）を先行しうる。 |
| `cancel_checkout`   | （**§3 にチェックアウト専用の取消ルートは記載なし**）                                                                                                                                                                                                                                                                                                                            | 運用・カスタムルートで方針を決める。現デモは MCP 上の状態のみ `canceled`。                                                             |


**§3 以外**: カタログ参照は **§3** `GET /store/products`、`GET /store/product-variants/{id}` 等。管理系は **§4 Admin**（通常は本 MCP Tool とは別系統）。

---

## 3. Tool `create_checkout`


| 項目                        | 内容                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 説明                        | 新規チェックアウトセッションを作成する（OpenRPC: `create_checkout`）。                                                                     |
| 入力                        | `meta`（上表）、`checkout`（オブジェクト。キー構造は規格スキーマに準拠して拡張。実装は `z.record` で緩い）                                                  |
| 応答                        | `id`（`co_<uuid>` 形式）、`status`（初期は `incomplete`）、`ucp_meta`、`checkout`（Medusa 連携時は `_ec_mirror` を含みうる）                |
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

**レスポンス例**（成功・Medusa 未連携時。`checkout._ec_mirror` は `null`）

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
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }],
    "_ec_mirror": null
  }
}
```

`EC_BACKEND_URL` と `EC_PUBLISHABLE_KEY` が有効な場合、`checkout._ec_mirror` に `{ "cart": { ... }, "lineItemSummary": ... }` または `{ "medusa_error": "...", "status": 400 }` が入る。

---

## 4. Tool `get_checkout`


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
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }],
    "_ec_mirror": null
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

## 5. Tool `update_checkout`


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
    "_ec_mirror": null,
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

## 6. Tool `complete_checkout`


| 項目                        | 内容                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 説明                        | チェックアウトを完了状態にする（OpenRPC: `complete_checkout`）。**注文確定・決済の Medusa 呼び出しは未実装**（デモ用状態遷移のみ）。                                                                                    |
| 入力                        | `meta`（`**idempotency-key` 必須**）、`id`、`checkout`（完了時にマージするオブジェクト）                                                                                                         |
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
    "_ec_mirror": null,
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

## 7. Tool `cancel_checkout`


| 項目                        | 内容                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 説明                        | チェックアウトを取消す（OpenRPC: `cancel_checkout`）。                                                                            |
| 入力                        | `meta`（`**idempotency-key` 必須**）、`id`                                                                               |
| 応答                        | `status: "canceled"` のレコード。                                                                                         |
| **api-reference.md との対応** | `**api-reference.md` §3 に相当する「取消」専用ルートは無い。** 実装ではインメモリ状態のみ `canceled` にする。Medusa 連携時はカート破棄方針・カスタム Store ルート等を別途決める。 |


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
    "line_items": [{ "variant_id": "variant_01EXAMPLE", "quantity": 1 }],
    "_ec_mirror": null
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

## 8. 起動例（開発用）

```bash
cd b-mcp-server
npm install
npm start
```

任意: Medusa と疎通させる場合。

```bash
export EC_BACKEND_URL=http://localhost:9000
export EC_PUBLISHABLE_KEY=pk_...
```

---

## 補足

- **MCP Tool と Medusa Store HTTP の対応**は **§2** の一覧と、各 Tool の表の **api-reference.md との対応**行を参照。
- 機械可読なメソッド定義は `references/ucp-shopping-mcp.openrpc.json`（および UCP 本家 OpenRPC）を正とする。本デモはチェックアウト系 5 Tool のみ実装。
- シーケンス・全体配置は `[sequence.md](sequence.md)` を参照。

