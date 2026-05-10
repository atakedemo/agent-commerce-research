# UCP 接続シーケンス（設計素案）

[atakedemo/agent-commerce-research の Issue #9 — UCP接続の設計書作成](https://github.com/atakedemo/agent-commerce-research/issues/9#issue-4330162750) の「シーケンス図の作成」に沿った、**アクター間の処理の受け渡し**と **UCP Shopping で定義されている MCP ツール**（[商品検索・詳細](#1-具体シーケンス商品検索詳細閲覧mcp-前提)、[カート追加](#2-具体シーケンスカート追加mcp-前提)、[チェックアウト](#3-具体シーケンスチェックアウト完了まで)）の利用関係を整理する。

- **規格の一次情報**: [Universal-Commerce-Protocol/ucp](https://github.com/Universal-Commerce-Protocol/ucp) の `[source/services/shopping/mcp.openrpc.json](https://github.com/Universal-Commerce-Protocol/ucp/blob/main/source/services/shopping/mcp.openrpc.json)`（本リポジトリでは [references/ucp-shopping-mcp.openrpc.json](../references/ucp-shopping-mcp.openrpc.json) にミラー）。
- **本デモの MCP 実装**: `[b-mcp-server/](../b-mcp-server/)` — 上記 OpenRPC のチェックアウト系メソッド名に合わせた Tool（`create_checkout` / `get_checkout` / `update_checkout` / `complete_checkout` / `cancel_checkout`）を [Model Context Protocol](https://modelcontextprotocol.io/)（stdio）で公開。人向けのツール説明は `[mcp-reference.md](mcp-reference.md)` を参照（カタログ・カート Tool は規格 OpenRPC 上に定義があるが、本デモサーバーでは未実装の場合がある）。
- **仕様リンク（カタログ・カート）**: [Catalog（概要）](../../../references/specification/community/ucp/docs/specification/catalog/index.md)、[Catalog — MCP 束縛](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md)、[Cart](../../../references/specification/community/ucp/docs/specification/cart.md)、[Cart — REST](../../../references/specification/community/ucp/docs/specification/cart-rest.md)、[Cart — MCP](../../../references/specification/community/ucp/docs/specification/cart-mcp.md)。
- **本書の前提（MCP 接続）**: マーチャントあたり **MCP の接続先は 1 点**。`/.well-known/ucp` の `services["dev.ucp.shopping"]` で `transport: "mcp"` とともに宣言される **単一の `endpoint`** に対し、エージェントは **同一 MCP セッション上の `tools/call`** でカタログ・カート・チェックアウトの各 Tool を呼び分ける（論理能力の違いであり、カタログ用・カート用など **複数 MCP URL を立てる前提ではない**）。

---

## 1. 具体シーケンス（商品検索・詳細閲覧、MCP 前提）

アクターは Issue 指定どおり: **ユーザー**、**AIエージェントアプリ（フロントエンド）**、**AIエージェントアプリ（バックエンド）**、**既存ECサイト（MCP・単一endpoint）**、**既存ECサイト（既存バックエンド）**。以降の §1〜§3 で登場する MCP は **いずれも同一 endpoint**（冒頭の前提どおり）。

仕様の論理能力・MCP Tool 名は [Catalog（概要）](../../../references/specification/community/ucp/docs/specification/catalog/index.md)、[Catalog — MCP](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md) を参照。

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U as ユーザー
        participant FE as AIエージェント<br/>（フロントエンド）
        participant BE as AIエージェント<br/>（バックエンド）
    end
    box rgb(255,248,240) 既存ECサイト側
        participant MCP as 既存ECサイト<br/>（MCP・単一endpoint）
        participant EC as 既存ECサイト<br/>（既存バックエンド）
    end

    U->>FE: 商品を探したい（自然言語）
    FE->>BE: エージェント推論・ツール呼び出し要求
    Note over BE,MCP: MCP `tools/call` — `search_catalog`<br/>meta.ucp-agent.profile 必須
    BE->>MCP: search_catalog(meta, catalog)
    MCP->>EC: 内部検索 API 等
    EC-->>MCP: 検索ヒット（商品・バリアント id 等）
    MCP-->>BE: Search 応答
    BE-->>FE: 候補の提示

    U->>FE: この商品の詳細を見たい
    FE->>BE: ツール呼び出し要求
    Note over BE,MCP: MCP `tools/call` — `get_product`
    BE->>MCP: get_product(meta, catalog)
    MCP->>EC: 商品マスタ／在庫参照
    EC-->>MCP: 詳細ペイロード
    MCP-->>BE: 商品詳細
    BE-->>FE: 説明・オプション・価格の提示
```

**補足（別経路）**: 複数の商品・バリアント id をまとめて解決するときは `lookup_catalog` を用いてもよい（同一 MCP・同一 `tools/call` の別 Tool 名）。検索・詳細のレスポンスはセッション非保証で再利用時は再取得を推奨する旨は [catalog/index.md — Relationship to Checkout](../../../references/specification/community/ucp/docs/specification/catalog/index.md#relationship-to-checkout) に準ずる。

カートに載せる準備が整ったら [§2](#2-具体シーケンスカート追加mcp-前提) へ進む。各 Tool の **入出力・例** は [`mcp-reference.md`](mcp-reference.md) **§3〜§5** を参照。

---

## 2. 具体シーケンス（カート追加、MCP 前提）

アクターは §1 と同じ。カート系 Tool は **§1 の続きとして同一 MCP 接続**で呼ぶ。仕様は [cart.md](../../../references/specification/community/ucp/docs/specification/cart.md)、REST 束縛 [cart-rest.md](../../../references/specification/community/ucp/docs/specification/cart-rest.md)、MCP 束縛 [cart-mcp.md](../../../references/specification/community/ucp/docs/specification/cart-mcp.md)。

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U as ユーザー
        participant FE as AIエージェント<br/>（フロントエンド）
        participant BE as AIエージェント<br/>（バックエンド）
    end
    box rgb(255,248,240) 既存ECサイト側
        participant MCP as 既存ECサイト<br/>（MCP・単一endpoint）
        participant EC as 既存ECサイト<br/>（既存バックエンド）
    end

    U->>FE: カートに入れる（自然言語）
    FE->>BE: エージェント推論・ツール呼び出し要求
    alt カート未作成
        Note over BE,MCP: MCP `tools/call` — `create_cart`
        BE->>MCP: create_cart(meta, cart)
        Note over BE,MCP: cart.line_items に item.id・quantity（<br/>§1 で得た id と整合）
        MCP->>EC: POST /carts 等（cart-rest と等価な内部処理）
        EC-->>MCP: 新規 cart.id・見積もり計上明細
        MCP-->>BE: Cart
    else 既存カートへ追加
        BE->>MCP: get_cart(meta, id)
        Note over BE,MCP: MCP `tools/call` — `get_cart`
        MCP-->>BE: 現在の line_items
        Note over BE: クライアント側で行追加・数量変更をマージ
        BE->>MCP: update_cart(meta, id, cart)
        Note over BE,MCP: MCP `tools/call` — `update_cart`<br/>置換セマンティクス（cart.md）
        MCP->>EC: PUT /carts/{id} 等
        EC-->>MCP: 更新後カート
        MCP-->>BE: Cart
    end
    BE-->>FE: カートサマリー
    FE-->>U: 追加結果の確認
```

**補足（更新の意味）**: `update_cart` はカートリソースの **全置換**（[Update Cart](../../../references/specification/community/ucp/docs/specification/cart.md#update-cart)）。既存行を失わないよう、**必ず** `get_cart` の結果にマージした **全体**を `cart` に渡す。

購入意思が確定したら [§3](#3-具体シーケンスチェックアウト完了まで) のとおり `create_checkout` に **`cart_id` を渡してカートからチェックアウトへ引き継ぐ**（カート機能がプロファイルで交渉されている場合。手引きは [cart.md — Cart-to-Checkout Conversion](../../../references/specification/community/ucp/docs/specification/cart.md#cart-to-checkout-conversion)）。カート系 Tool の **入出力・例** は [`mcp-reference.md`](mcp-reference.md) **§6〜§8** を参照。

---

## 3. 具体シーケンス（チェックアウト完了まで）

アクターは Issue 指定どおり: **ユーザー**、**AIエージェントアプリ（フロントエンド）**、**AIエージェントアプリ（バックエンド）**、**既存ECサイト（MCP・§1・§2 と同一 endpoint）**、**既存ECサイト（既存バックエンド）**。チェックアウト系 Tool も **§1・§2 と同じ MCP 接続**で呼ぶ（別プロセス・別 URL の MCP は前提としない）。

**決済トークン発行について**: UCP の Payment Handler（`com.google.pay` 等）との連携は **MCP の外**で行う。`create_checkout` のレスポンスに含まれる `payment_handlers` config を使い、Platform が Payment Handler を直接呼び出してトークン（`PaymentInstrument`）を取得する。取得したトークンを `complete_checkout` の `payment.instruments` に渡すことで決済が完結する（[payment-handler-guide.md](../../../references/specification/community/ucp/docs/specification/payment-handler-guide.md)、[tokenization-guide.md](../../../references/specification/community/ucp/docs/specification/tokenization-guide.md)）。

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U as ユーザー
        participant FE as AIエージェント<br/>（フロントエンド）
        participant BE as AIエージェント<br/>（バックエンド）
    end
    box rgb(230,255,230) 外部決済・決済 PSP
        participant PayHandler as Payment Handler<br/>（d-payment-handler）
        participant Stripe as Stripe API
    end
    box rgb(255,248,240) 既存ECサイト側
        participant MCP as 既存ECサイト<br/>（MCP・単一endpoint）
        participant EC as 既存ECサイト<br/>（既存バックエンド）
    end

    U->>FE: 購入・注文の依頼（自然言語）
    FE->>BE: エージェント推論・ツール呼び出し要求
    Note over BE,MCP: MCP `tools/call` — OpenRPC `create_checkout`<br/>meta.ucp-agent.profile 必須
    BE->>MCP: create_checkout(meta, checkout)
    MCP->>EC: （任意）カート/在庫/価格の取得・更新など内部API
    EC-->>MCP: ドメイン結果
    MCP-->>BE: Checkout（id, status:"incomplete",<br/>payment_handlers:[{handler: "com.google.pay", config:{...}}]）
    BE-->>FE: 画面用テキスト・UI状態

    FE->>BE: 配送先・メール等の確定・更新
    BE->>MCP: update_checkout(meta, id, checkout{email, shipping_address})
    MCP->>EC: 内部API（計算・検証・保留状態の更新）
    EC-->>MCP: 更新後スナップショット
    MCP-->>BE: Checkout（status:"ready_for_complete"）

    BE->>MCP: get_checkout(meta, id)
    MCP-->>BE: 権威ある状態（表示・分岐用）

    rect rgb(204,255,204)
        Note over FE,Stripe: 【決済トークン発行】MCP外 — d-payment-handler + Stripe 連携
        FE-->>BE: カード情報を入力（番号・有効期限・CVV）
        BE->>PayHandler: POST /tokenize<br/>{ credential:{payment_method_id}, binding:{checkout_id}, amount, currency }
        PayHandler->>Stripe: paymentIntents.create<br/>{ amount, currency, payment_method, confirm:false }
        Stripe-->>PayHandler: PaymentIntent { id:"pi_xxx", status:"requires_confirmation" }
        PayHandler-->>BE: { token:"ucp_tok_xxx", expiry }
        BE-->>FE: 決済トークン発行完了
    end

    Note over BE,MCP: 完了/取消は meta.idempotency-key 必須（OpenRPC）
    BE->>MCP: complete_checkout(meta, id,<br/>checkout{payment:{instruments:[{<br/>type:"card",<br/>credential:{token:"ucp_tok_xxx"},<br/>display:{brand:"visa",last4:"4242"}}]}})
    MCP->>PayHandler: POST /detokenize<br/>{ token:"ucp_tok_xxx", binding:{checkout_id} }
    PayHandler-->>MCP: { payment_intent_id:"pi_xxx",<br/>payment_intent_status:"requires_confirmation" }
    MCP->>Stripe: POST /v1/payment_intents/pi_xxx/confirm
    Stripe-->>MCP: PaymentIntent { status:"succeeded" }
    MCP->>EC: チェックアウト完了<br/>（Medusa POST /store/carts/{id}/complete）
    EC-->>MCP: 注文確定結果
    MCP-->>BE: Checkout（status:"completed", order_id）
    BE-->>FE: 完了メッセージ
    FE-->>U: 確認・レシート相当の提示
```

**取消フロー（任意経路）**: `complete_checkout` の代わりに `cancel_checkout(meta, id)` が呼ばれ、MCP サーバーが既存バックエンド上の保留取引を安全に破棄する想定。決済トークン発行後にキャンセルする場合は、Payment Handler 側のトークン失効とあわせて処理する。

---

### 補足：決済トークン発行の詳細（d-payment-handler + Stripe 実装）

本デモでは `d-payment-handler` が Tokenizer として動作し、Stripe の PaymentIntent API を利用して UCP トークンを発行する。

#### 1. `create_checkout` レスポンスの参照パス

`PAYMENT_HANDLER_URL` が設定されている場合、`b-mcp-server` の `create_checkout` レスポンスに `payment_handlers` が付加される。

```json
{
  "id": "co_3f7c8e2a-...",
  "status": "incomplete",
  "ucp_meta": { "ucp-agent": { "profile": "https://..." } },
  "checkout": {
    "payment_handlers": {
      "dev.ucp.payment.stripe": [
        {
          "version": "2026-01-15",
          "tokenizer": "external",
          "endpoint": "http://localhost:3200",
          "operations": ["/tokenize"]
        }
      ]
    }
  }
}
```

| 参照パス | 用途 |
| :--- | :--- |
| `checkout.payment_handlers["dev.ucp.payment.stripe"][0].endpoint` | `POST /tokenize` の送信先（d-payment-handler URL） |
| `checkout.payment_handlers["dev.ucp.payment.stripe"][0].operations` | 利用可能なエンドポイント（`["/tokenize"]`） |
| `id`（レスポンスルート） | `binding.checkout_id` として `/tokenize` に渡す |

#### 2. Platform → d-payment-handler: POST /tokenize

Buyer がカード情報を入力した後、Platform（c-ai-agent-app）は `d-payment-handler` の `/tokenize` を呼び出す。

**リクエスト**

```http
POST http://localhost:3200/tokenize
Content-Type: application/json

{
  "credential": {
    "payment_method_id": "pm_card_visa"
  },
  "binding": {
    "checkout_id": "co_3f7c8e2a-..."
  },
  "amount": 1000,
  "currency": "jpy"
}
```

> **注**: `credential.payment_method_id` は Stripe の PaymentMethod ID。本デモでは `pm_card_visa`（テスト用）を使用。実運用では Stripe.js で実際のカード情報をトークン化して取得した `pm_*` を渡す。

**d-payment-handler 内部処理（Stripe モード）**

```
stripe.paymentIntents.create({
  amount: 1000,
  currency: "jpy",
  payment_method: "pm_card_visa",
  confirm: false,
  metadata: { checkout_id: "co_3f7c8e2a-..." }
})
→ PaymentIntent { id: "pi_xxx", status: "requires_confirmation" }

tokenStore.set("ucp_tok_xxx", {
  paymentIntentId: "pi_xxx",
  checkoutId: "co_3f7c8e2a-...",
  amount: 1000,
  currency: "jpy",
  expiresAt: <30分後>,
  isMock: false
})
```

**レスポンス**

```json
{
  "token": "ucp_tok_a3b8f2c1d4e5...",
  "expiry": "2026-05-10T11:00:00.000Z"
}
```

#### 3. Platform → MCP: complete_checkout（UCP トークンを含む）

取得した UCP トークンを `checkout.payment.instruments` に格納して `complete_checkout` を呼び出す。

```json
{
  "meta": {
    "ucp-agent": { "profile": "https://demo-agent.example/.well-known/ucp" },
    "idempotency-key": "550e8400-e29b-41d4-a716-446655440000"
  },
  "id": "co_3f7c8e2a-...",
  "checkout": {
    "payment": {
      "instruments": [
        {
          "type": "card",
          "credential": {
            "token": "ucp_tok_a3b8f2c1d4e5..."
          },
          "display": {
            "brand": "visa",
            "last4": "4242"
          }
        }
      ]
    }
  }
}
```

#### 4. MCP → d-payment-handler: POST /detokenize（complete_checkout 内部）

`b-mcp-server` は `complete_checkout` の処理中に `/detokenize` を呼び出してトークンを検証・デコードする（単回使用で即失効）。

**リクエスト**

```http
POST http://localhost:3200/detokenize
Content-Type: application/json

{
  "token": "ucp_tok_a3b8f2c1d4e5...",
  "binding": {
    "checkout_id": "co_3f7c8e2a-..."
  }
}
```

**レスポンス**

```json
{
  "payment_intent_id": "pi_xxx",
  "payment_intent_status": "requires_confirmation",
  "amount": 1000,
  "currency": "jpy"
}
```

#### 5. MCP → Stripe: PaymentIntent confirm（complete_checkout 内部）

`b-mcp-server` はデコードされた `payment_intent_id` を使い、Stripe REST API を直接呼び出して決済を確定する。

```http
POST https://api.stripe.com/v1/payment_intents/pi_xxx/confirm
Authorization: Bearer sk_test_...
Content-Type: application/x-www-form-urlencoded
```

**レスポンス（成功時）**

```json
{
  "id": "pi_xxx",
  "status": "succeeded",
  "amount": 1000,
  "currency": "jpy"
}
```

Stripe 確定後、Medusa の `POST /store/carts/{id}/complete` を呼び出して注文を確定し、`order_id` を `complete_checkout` のレスポンスに含めて返す。

| 処理ステップ | 実行主体 | API |
| :--- | :--- | :--- |
| UCP トークン発行 | Platform（c-ai-agent-app） | `d-payment-handler POST /tokenize` |
| Stripe PaymentIntent 作成 | d-payment-handler | `stripe.paymentIntents.create` |
| UCP トークン検証・デコード | MCP（b-mcp-server） | `d-payment-handler POST /detokenize` |
| Stripe 決済確定 | MCP（b-mcp-server） | `Stripe API POST /v1/payment_intents/{id}/confirm` |
| 注文確定 | MCP（b-mcp-server） | `Medusa POST /store/carts/{id}/complete` |

---

カタログ・カート・チェックアウト各 Tool の **説明・入力・応答例**は [`mcp-reference.md`](mcp-reference.md) を参照（カタログ・カートは **§3〜§8**、チェックアウトは **§9 以降**）。

---

## 4. 抽象シーケンス（役割ベース）

実装名に依存しない読み替え用。

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) チャネル
        participant User as ユーザー
        participant UI as UI
        participant AgentAPI as エージェントAPI<br/>（オーケストレーション）
    end
    box rgb(255,248,240) コマース境界
        participant MCP as MCP<br/>（単一endpoint・Tools）
        participant Domain as コマース<br/>ドメインサービス
    end

    User->>UI: 目的表明
    UI->>AgentAPI: 意図・コンテキスト
    AgentAPI->>MCP: Tool: セッション作成（create）
    MCP->>Domain: 永続化・価格/在庫整合
    Domain-->>MCP: セッション状態
    MCP-->>AgentAPI: 機械可読なセッション
    AgentAPI-->>UI: 説明・次アクション

    AgentAPI->>MCP: Tool: 更新（update）
    MCP->>Domain: ルール検証・再計算
    Domain-->>MCP: 新状態
    MCP-->>AgentAPI: 更新結果

    AgentAPI->>MCP: Tool: 取得（get）
    MCP-->>AgentAPI: スナップショット

    AgentAPI->>MCP: Tool: 完了（complete） / 取消（cancel）
    MCP->>Domain: 注文確定 or キャンセル
    Domain-->>MCP: 確定結果
    MCP-->>AgentAPI: 最終状態
    AgentAPI-->>UI: 完了通知
    UI-->>User: フィードバック
```



---

## 5. MCP ツールと規格の対応（カタログ・カート・チェックアウト）

各 Tool の **説明・`arguments`／応答の例**は [`mcp-reference.md`](mcp-reference.md) **§3〜§13**（カタログ・カート §3〜§8、チェックアウト §9〜§13）。

OpenRPC でのメソッド名は [ucp-shopping-mcp.openrpc.json](../references/ucp-shopping-mcp.openrpc.json) に **ひとまとまり**で載る。エージェントが解決するのはマーチャントの **`/.well-known/ucp`** における `services["dev.ucp.shopping"]` の **MCP transport 用 URL 1 つ**であり、下表のカタログ・カート・チェックアウトの各 Tool は **その同一 endpoint 上の `tools/call` の `name` 違い**として扱う（本デモの `b-mcp-server` はチェックアウト中心の参照実装で、カタログ／カート Tool は未実装の場合がある）。

### カタログ（MCP）


| MCP Tool         | UCP OpenRPC メソッド | 仕様（論理能力）                                                                                                                  | 備考                                                                                                                                   |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `search_catalog` | `search_catalog` | `[dev.ucp.shopping.catalog.search](../../../references/specification/community/ucp/docs/specification/catalog/search.md)` | キーワード・フィルタ・ページネーション等。[Catalog MCP](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md#search_catalog) |
| `lookup_catalog` | `lookup_catalog` | `[dev.ucp.shopping.catalog.lookup](../../../references/specification/community/ucp/docs/specification/catalog/lookup.md)` | 識別子のバッチ解決                                                                                                                            |
| `get_product`    | `get_product`    | 同上（詳細取得）                                                                                                                  | 商品詳細・オプション選択に利用。`[get_product](../../../references/specification/community/ucp/docs/specification/catalog/mcp.md#get_product)`       |


### カート（MCP）


| MCP Tool      | UCP OpenRPC メソッド | 仕様                                                                                                    | 備考                                                                                                                                                                                                                                                                     |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_cart` | `create_cart`    | [Create Cart](../../../references/specification/community/ucp/docs/specification/cart.md#create-cart) | `cart.line_items` で初回から明細を載せられる。[MCP 例](../../../references/specification/community/ucp/docs/specification/cart-mcp.md#create_cart)。HTTP 束縛は [cart-rest.md — POST /carts](../../../references/specification/community/ucp/docs/specification/cart-rest.md#create-cart) |
| `get_cart`    | `get_cart`       | [Get Cart](../../../references/specification/community/ucp/docs/specification/cart.md#get-cart)       | 既存カートのスナップショット。追加前のマージ元                                                                                                                                                                                                                                                |
| `update_cart` | `update_cart`    | [Update Cart](../../../references/specification/community/ucp/docs/specification/cart.md#update-cart) | **全置換**。行追加は `get_cart` → マージ → `update_cart`                                                                                                                                                                                                                          |
| `cancel_cart` | `cancel_cart`    | [Cancel Cart](../../../references/specification/community/ucp/docs/specification/cart.md#cancel-cart) | セッション破棄                                                                                                                                                                                                                                                                |


### チェックアウト（MCP）


| MCP Tool（本デモ `b-mcp-server`） | UCP OpenRPC メソッド    | 備考                                                                                                                                                                           |
| ---------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_checkout`            | `create_checkout`   | `meta` 必須、`ucp-agent.profile` 必須。カート利用時は `cart_id` で引き継ぎ可（[cart.md](../../../references/specification/community/ucp/docs/specification/cart.md#cart-to-checkout-conversion)）。レスポンスに `payment_handlers` config が含まれる |
| `get_checkout`               | `get_checkout`      | `id` はチェックアウト識別子                                                                                                                                                             |
| `update_checkout`            | `update_checkout`   | 差分更新セマンティクスは規格側スキーマに準拠して拡張                                                                                                                                                   |
| —（MCP外）                    | —                   | **【決済トークン発行】** `create_checkout` レスポンスの `payment_handlers` config を用い、Platform が Payment Handler（例: `com.google.pay`）を直接呼び出してトークンを取得する。MCP Tool ではなく Platform 側の処理（§3 シーケンス参照） |
| `complete_checkout`          | `complete_checkout` | `meta.idempotency-key` 必須。`checkout.payment.instruments` に決済トークン発行で得た `PaymentInstrument`（handler_id・type・credential・billing_address 等）を含めて送信する                              |
| `cancel_checkout`            | `cancel_checkout`   | `meta.idempotency-key` 必須                                                                                                                                                    |


---

## 6. MCP サーバーの起動（開発用）

手順の詳細は **[`mcp-reference.md`](mcp-reference.md) §14** を参照。概要のみ:

```bash
cd demos/01-sample-ucp_ap2/b-mcp-server
npm install
npm start
```

## 7. Assumptions

- **MCP はマーチャントあたり単一 endpoint** を前提とする。**§1〜§3** の具体シーケンスは同一 MCP サーバー（同一接続）上の Tool 列として読む。Tool の入出力・例は [`mcp-reference.md`](mcp-reference.md) §3 以降。複数 MCP エンドポイントへ意図的に分割する構成は本書のスコープ外。
- **認証・署名**（`meta.signature`、HTTP における `UCP-Agent` 相当）の厳密な検証は本デモでは未実装。規格上の必須/推奨は [UCP 仕様リポジトリ](https://github.com/Universal-Commerce-Protocol/ucp) 側の最新版に従う。
- **既存バックエンド**が Medusa の場合、UCP の `Checkout` JSON と Store API のカート/注文は **1:1 ではない**。本図は「MCP 層がアダプタとなり内部 API を呼ぶ」という責務分割のみ示し、フィールドマッピングは別タスクとする。

