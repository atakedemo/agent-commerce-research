# UCP 接続シーケンス（GCPデプロイ版）

本書は `demos/01-sample-ucp_ap2/zz-docs/sequence.md` をGCPデプロイ構成に対応させたものである。
ローカル開発版との主な差分は以下の通り。

| 差分項目 | ローカル開発版 | GCPデプロイ版 |
|---|---|---|
| b-mcp-server 起動方式 | stdio（サブプロセス） | HTTP（Cloud Run + StreamableHTTP transport） |
| サービス間通信 | localhost ポート直接 | Cloud Run 内部URL（HTTPS） |
| MCP クライアント接続 | `StdioClientTransport` | `StreamableHTTPClientTransport` |
| DB 接続 | PostgreSQL（localhost） | Cloud SQL Auth Proxy（Unix ソケット） |
| シークレット | `.env` ファイル | Secret Manager（Cloud Run 環境変数マウント） |

---

## GCP サービス対応表

| ローカル名称 | GCP Cloud Run サービス名 | 内部エンドポイント |
|---|---|---|
| c-ai-agent-app（FE/BE） | `ai-agent-app` | `https://ai-agent-app-<hash>-an.a.run.app` |
| b-mcp-server | `mcp-server` | `https://mcp-server-<hash>-an.a.run.app` |
| d-payment_handler | `payment-handler` | `https://payment-handler-<hash>-an.a.run.app` |
| e-trusted_surface | `trusted-surface` | `https://trusted-surface-<hash>-an.a.run.app` |
| a-sandbox-ec（backend） | `ec-backend` | `https://ec-backend-<hash>-an.a.run.app` |
| a-sandbox-ec（storefront） | `ec-storefront` | `https://ec-storefront-<hash>-an.a.run.app`（公開） |

> 内部エンドポイントは Cloud Run の `--ingress internal-and-cloud-load-balancing` 設定により外部から直接アクセス不可。サービス間呼び出しはサービスアカウントの `run.invoker` ロールで認証。

---

## 0. ユーザー認証フロー（サインアップ・ログイン・Google SSO）

GCP版では `ai-agent-app`（Cloud Run）と `payment-handler`（Cloud Run 内部）間の通信となる。

### 0-1. サインアップ

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U  as ユーザー
        participant FE as ai-agent-app<br/>（フロントエンド）
        participant BE as ai-agent-app<br/>（バックエンド）
    end
    box rgb(230,255,230) Cloud Run 内部
        participant PH as payment-handler<br/>（Cloud Run 内部URL）
    end

    U->>FE: サインアップフォームに入力<br/>（名前・メール・パスワード・住所・任意カード）
    FE->>BE: POST /api/auth/signup
    BE->>PH: POST /auth/signup<br/>（Cloud Run 内部URL + Bearer token）
    Note over PH: PBKDF2 ハッシュ化・authToken 発行（24h TTL）<br/>Secret Manager からシークレット参照
    PH-->>BE: { userId, email, profile, cards, accessToken }
    Note over BE: _authSession をメモリに保持
    BE-->>FE: 認証セッション情報
    FE-->>U: ログイン済みバー表示
```

### 0-2. ログイン

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U  as ユーザー
        participant FE as ai-agent-app<br/>（フロントエンド）
        participant BE as ai-agent-app<br/>（バックエンド）
    end
    box rgb(230,255,230) Cloud Run 内部
        participant PH as payment-handler<br/>（Cloud Run 内部URL）
    end

    U->>FE: メール・パスワードを入力
    FE->>BE: POST /api/auth/login { email, password }
    BE->>PH: POST /auth/login<br/>（Cloud Run 内部URL + Bearer token）
    Note over PH: PBKDF2 検証・authToken 発行（24h TTL）
    PH-->>BE: { userId, email, profile, cards, accessToken }
    Note over BE: _authSession を更新
    BE-->>FE: 認証セッション情報
    FE-->>U: ログイン済みバー表示
```

### 0-3. Google SSO

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U   as ユーザー
        participant FE  as ai-agent-app<br/>（フロントエンド）
        participant BE  as ai-agent-app<br/>（バックエンド）
    end
    box rgb(255,245,230) Google
        participant GIS       as Google Identity Services
        participant GTokenInfo as Google tokeninfo API
    end
    box rgb(230,255,230) Cloud Run 内部
        participant PH as payment-handler<br/>（Cloud Run 内部URL）
    end

    U->>FE: 「Google でサインイン」クリック
    FE->>GIS: google.accounts.id.prompt()
    GIS-->>FE: id_token（JWT）
    FE->>BE: POST /api/auth/google { id_token }
    BE->>PH: POST /auth/google { id_token }<br/>（Cloud Run 内部URL + Bearer token）
    PH->>GTokenInfo: GET /tokeninfo?id_token={id_token}
    Note over PH: GOOGLE_CLIENT_ID は Secret Manager から取得<br/>aud 検証・userStore upsert・authToken 発行
    GTokenInfo-->>PH: { sub, email, name, ... }
    PH-->>BE: { userId, email, profile, cards, accessToken }
    Note over BE: _authSession を更新
    BE-->>FE: 認証セッション情報
    FE-->>U: ログイン済みバー表示
```

---

## 1. 商品検索・詳細閲覧（MCP over HTTP）

GCP版では `ai-agent-app` → `mcp-server`（Cloud Run 内部URL）へ StreamableHTTP transport で接続する。

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U as ユーザー
        participant FE as ai-agent-app<br/>（フロントエンド）
        participant BE as ai-agent-app<br/>（バックエンド）
    end
    box rgb(255,248,240) ECサイト側（Cloud Run）
        participant MCP as mcp-server<br/>（Cloud Run 内部URL）
        participant EC as ec-backend<br/>（Cloud Run 内部URL）
    end
    box rgb(230,240,230) GCPデータ基盤
        participant SQL as Cloud SQL<br/>（PostgreSQL 15）
    end

    U->>FE: 商品を探したい（自然言語）
    FE->>BE: エージェント推論・ツール呼び出し要求
    Note over BE,MCP: StreamableHTTP transport<br/>POST /mcp（Cloud Run 内部URL）<br/>tools/call — search_catalog
    BE->>MCP: search_catalog(meta, catalog)
    MCP->>EC: 内部API（Cloud Run 内部URL）
    EC->>SQL: SELECT 商品テーブル（Cloud SQL Auth Proxy）
    SQL-->>EC: 検索結果
    EC-->>MCP: 検索ヒット
    MCP-->>BE: Search 応答
    BE-->>FE: 候補の提示

    U->>FE: この商品の詳細を見たい
    FE->>BE: ツール呼び出し要求
    Note over BE,MCP: tools/call — get_product
    BE->>MCP: get_product(meta, catalog)
    MCP->>EC: 商品マスタ参照
    EC->>SQL: SELECT（Cloud SQL Auth Proxy）
    SQL-->>EC: 詳細データ
    EC-->>MCP: 詳細ペイロード
    MCP-->>BE: 商品詳細
    BE-->>FE: 説明・オプション・価格の提示
```

---

## 2. カート追加（MCP over HTTP）

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U as ユーザー
        participant FE as ai-agent-app<br/>（フロントエンド）
        participant BE as ai-agent-app<br/>（バックエンド）
    end
    box rgb(255,248,240) ECサイト側（Cloud Run）
        participant MCP as mcp-server<br/>（Cloud Run 内部URL）
        participant EC as ec-backend<br/>（Cloud Run 内部URL）
    end
    box rgb(230,240,230) GCPデータ基盤
        participant Redis as Memorystore<br/>（Redis 7）
    end

    U->>FE: カートに入れる（自然言語）
    FE->>BE: エージェント推論・ツール呼び出し要求
    alt カート未作成
        Note over BE,MCP: tools/call — create_cart
        BE->>MCP: create_cart(meta, cart)
        MCP->>EC: POST /store/carts（Cloud Run 内部URL）
        EC->>Redis: セッション・カートキャッシュ
        Redis-->>EC: OK
        EC-->>MCP: 新規 cart.id・明細
        MCP-->>BE: Cart
    else 既存カートへ追加
        BE->>MCP: get_cart(meta, id)
        MCP-->>BE: 現在の line_items
        Note over BE: クライアント側でマージ
        BE->>MCP: update_cart(meta, id, cart)
        MCP->>EC: PUT /store/carts/{id}（Cloud Run 内部URL）
        EC-->>MCP: 更新後カート
        MCP-->>BE: Cart
    end
    BE-->>FE: カートサマリー
    FE-->>U: 追加結果の確認
```

---

## 3. チェックアウト完了まで（UCP フロー）

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U as ユーザー
        participant FE as ai-agent-app<br/>（フロントエンド）
        participant BE as ai-agent-app<br/>（バックエンド）
    end
    box rgb(230,255,230) Cloud Run 内部
        participant PayHandler as payment-handler<br/>（Cloud Run 内部URL）
        participant Stripe as Stripe API
    end
    box rgb(255,248,240) ECサイト側（Cloud Run）
        participant MCP as mcp-server<br/>（Cloud Run 内部URL）
        participant EC as ec-backend<br/>（Cloud Run 内部URL）
    end

    U->>FE: 購入・注文の依頼（自然言語）
    FE->>BE: エージェント推論・ツール呼び出し要求
    Note over BE,MCP: tools/call — create_checkout
    BE->>MCP: create_checkout(meta, checkout)
    MCP->>EC: 在庫・価格確認（Cloud Run 内部URL）
    EC-->>MCP: 確認結果
    MCP-->>BE: Checkout { id, status:"incomplete", payment_handlers }

    FE->>BE: 配送先・メール等の確定
    BE->>MCP: update_checkout(meta, id, checkout)
    MCP->>EC: 更新処理
    EC-->>MCP: 更新後スナップショット
    MCP-->>BE: Checkout { status:"ready_for_complete" }

    alt ログイン中かつカード登録済み（自動トークナイズ）
        FE->>BE: POST /api/tokenize { checkout_id, registered_card }
        BE->>PayHandler: POST /tokenize<br/>（Cloud Run 内部URL + Bearer token）
        PayHandler->>Stripe: paymentIntents.create<br/>（STRIPE_SECRET_KEY は Secret Manager）
        Stripe-->>PayHandler: PaymentIntent { id:"pi_xxx" }
        PayHandler-->>BE: { token:"ucp_tok_xxx", expiry }
        BE-->>FE: { token:"ucp_tok_xxx" }
        FE-->>U: 「決済トークンが発行されました（自動）」
    else カード未登録・未ログイン（手動モーダル）
        FE-->>U: 決済モーダル表示
        U->>FE: カード情報を入力
        FE->>BE: POST /api/tokenize { checkout_id, card_info }
        BE->>PayHandler: POST /tokenize（Cloud Run 内部URL）
        PayHandler->>Stripe: paymentIntents.create
        Stripe-->>PayHandler: PaymentIntent { id:"pi_xxx" }
        PayHandler-->>BE: { token:"ucp_tok_xxx", expiry }
        BE-->>FE: { token:"ucp_tok_xxx" }
        FE-->>U: 「決済トークンが発行されました」
    end

    BE->>MCP: complete_checkout(meta{idempotency-key}, id,<br/>checkout{ payment:{ instruments:[{ credential:{ token } }] } })
    MCP->>PayHandler: POST /detokenize（Cloud Run 内部URL）
    PayHandler-->>MCP: { payment_intent_id:"pi_xxx" }
    MCP->>Stripe: POST /v1/payment_intents/pi_xxx/confirm
    Stripe-->>MCP: { status:"succeeded" }
    MCP->>EC: POST /store/carts/{id}/complete（Cloud Run 内部URL）
    EC-->>MCP: 注文確定 { order_id }
    MCP-->>BE: Checkout { status:"completed", order_id }
    BE-->>FE: 完了メッセージ
    FE-->>U: 確認・レシートの提示
```

---

## 4. AP2 HNP フロー（Human Not Present / 自律決済）

### Phase 1a — ユーザー在席時（Open Mandate の委任）

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) 利用者・エージェント側
        participant U   as ユーザー
        participant FE  as ai-agent-app<br/>（フロントエンド）
        participant BE  as ai-agent-app<br/>（バックエンド）
    end
    box rgb(255,240,255) Cloud Run 内部
        participant TS  as trusted-surface<br/>（Cloud Run 内部URL）
    end

    U->>FE: 購入タスクと制約を設定
    FE->>BE: Agent 鍵ペアを生成・Intent を構造化
    Note over BE: ephemeral ECDSA P-256 鍵ペア生成
    BE->>TS: POST /open-mandate<br/>（Cloud Run 内部URL + Bearer token）
    Note over TS: ユーザーへ Mandate Content を表示<br/>同意確認後に user_sk で署名<br/>TRUSTED_SURFACE_API_KEY は Secret Manager
    TS-->>BE: { open_checkout_mandate (JWT),<br/>open_payment_mandate (JWT),<br/>wallet_public_key (JWK) }
    BE-->>FE: オープン Mandate 取得完了
    FE-->>U: 委任完了（ユーザーはここで離席）
```

### Phase 1b — Human Not Present（自律ショッピング）

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) エージェント側
        participant FE  as ai-agent-app<br/>（フロントエンド）
        participant BE  as ai-agent-app<br/>（バックエンド）
    end
    box rgb(255,248,240) Cloud Run 内部
        participant MCP as mcp-server<br/>（Cloud Run 内部URL）
        participant EC  as ec-backend<br/>（Cloud Run 内部URL）
    end

    Note over BE,MCP: Phase 1a で取得したオープン Mandate を保持して自律実行
    BE->>MCP: search_catalog / get_product（StreamableHTTP）
    MCP-->>BE: 商品情報

    BE->>MCP: create_cart / update_cart
    MCP->>EC: POST /store/carts（Cloud Run 内部URL）
    EC-->>MCP: カート状態
    MCP-->>BE: Cart

    BE->>MCP: create_checkout(meta, checkout)
    MCP->>EC: 在庫・価格確認
    EC-->>MCP: 確認結果
    Note over MCP: Agent Provider 鍵で checkout JWT を ES256 署名
    MCP-->>BE: Checkout { id, checkout_jwt, checkout_hash,<br/>merchant_jwks, payment_handlers }

    Note over BE: checkout_hash = SHA-256(checkout_jwt)<br/>クローズド Checkout/Payment Mandate を agent_sk で署名
```

### Phase 2 — Human Not Present（自律決済）

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) エージェント側
        participant FE  as ai-agent-app<br/>（フロントエンド）
        participant BE  as ai-agent-app<br/>（バックエンド）
    end
    box rgb(230,240,255) Cloud Run 内部（Credential Provider）
        participant CP  as payment-handler<br/>（/credential エンドポイント）
        participant TS  as trusted-surface<br/>（/jwks エンドポイント）
    end
    box rgb(255,248,240) Cloud Run 内部（ECサイト）
        participant MCP as mcp-server
        participant EC  as ec-backend
    end

    BE->>CP: POST /credential<br/>{ open_payment_mandate, closed_payment_mandate, checkout_hash }<br/>（Cloud Run 内部URL）

    rect rgb(204,230,255)
        Note over CP,TS: Open Payment Mandate 検証
        CP->>TS: GET /jwks（Cloud Run 内部URL・5分キャッシュ）
        TS-->>CP: { keys: [JWK] }
        Note over CP: TS 公開鍵で ES256 署名検証<br/>vct・制約評価（金額・マーチャント・支払手段）
    end

    CP-->>BE: { token:"ucp_tok_xxx", expiry, transaction_id }

    BE->>MCP: complete_checkout(meta{idempotency-key}, id,<br/>checkout{ payment:{ instruments:[{ credential:{ token } }] } })

    rect rgb(255,240,204)
        MCP->>CP: POST /detokenize（Cloud Run 内部URL）
        Note over CP: type=="credential" 確認<br/>checkout_hash 一致確認<br/>単回使用・即時削除
        CP-->>MCP: { transaction_id, payment_amount, _ap2:true }
    end

    rect rgb(255,240,204)
        MCP->>EC: POST /store/shipping-options（Cloud Run 内部URL）
        EC-->>MCP: 配送オプション
        MCP->>EC: POST /store/carts/{id}/shipping-methods
        EC-->>MCP: OK
        MCP->>EC: POST /store/payment-collections
        EC-->>MCP: { payment_collection.id }
        MCP->>EC: POST /store/carts/{id}/complete
        EC-->>MCP: { order:{ id:"order_xxx" } }
    end

    MCP-->>BE: Checkout { status:"completed", order_id }
    BE-->>FE: 購入完了メッセージ
```

---

## 5. 抽象シーケンス（役割ベース・GCP構成）

```mermaid
sequenceDiagram
    autonumber
    box rgb(240,248,255) チャネル（公開 Cloud Run）
        participant User as ユーザー
        participant UI as ai-agent-app<br/>（公開エンドポイント）
        participant AgentAPI as ai-agent-app<br/>（バックエンド）
    end
    box rgb(255,248,240) コマース境界（内部 Cloud Run）
        participant MCP as mcp-server<br/>（StreamableHTTP）
        participant Domain as ec-backend<br/>（+ Cloud SQL / Redis）
    end

    User->>UI: 目的表明
    UI->>AgentAPI: 意図・コンテキスト
    AgentAPI->>MCP: StreamableHTTP POST /mcp<br/>tools/call: セッション作成（create）
    MCP->>Domain: 永続化・価格/在庫整合
    Domain-->>MCP: セッション状態
    MCP-->>AgentAPI: 機械可読なセッション
    AgentAPI-->>UI: 説明・次アクション

    AgentAPI->>MCP: tools/call: 更新（update）
    MCP->>Domain: ルール検証・再計算
    Domain-->>MCP: 新状態
    MCP-->>AgentAPI: 更新結果

    AgentAPI->>MCP: tools/call: 完了（complete）
    MCP->>Domain: 注文確定
    Domain-->>MCP: 確定結果
    MCP-->>AgentAPI: 最終状態
    AgentAPI-->>UI: 完了通知
    UI-->>User: フィードバック
```

---

## 6. ローカル開発版からの変更点（コード）

### b-mcp-server: HTTP transport ラッパー

```
b-mcp-server/src/
├── server.js       (既存・変更なし)
├── medusa.js       (既存・変更なし)
└── http-server.js  (新規追加)
```

`http-server.js` は `StreamableHTTPServerTransport` を使用し、`server.js` の MCP Server インスタンスをHTTPでサーブする。環境変数 `PORT`（デフォルト: 3000）でリッスン。

### c-ai-agent-app: トランスポート切り替え

`src/mcp-client.js` に以下の分岐を追加：

```
MCP_SERVER_URL が設定されている場合
  → StreamableHTTPClientTransport (Cloud Run 内部URL)
未設定の場合
  → StdioClientTransport（ローカル開発向けサブプロセス起動）
```

### 環境変数（GCP版追加分）

| 変数名 | サービス | 設定先 |
|---|---|---|
| `MCP_SERVER_URL` | ai-agent-app | Cloud Run 環境変数（mcp-server 内部URL） |
| `PAYMENT_HANDLER_URL` | ai-agent-app, mcp-server | Cloud Run 環境変数（payment-handler 内部URL） |
| `TRUSTED_SURFACE_URL` | payment-handler | Cloud Run 環境変数（trusted-surface 内部URL） |
| `DATABASE_URL` | ec-backend | `/cloudsql/<instance>` Unix ソケット形式 |
| `REDIS_URL` | ec-backend | `redis://<Memorystore IP>:6379` |
