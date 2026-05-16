# 設計概要

本ディレクトリ [`demos/01-sample-ucp_ap2`](../) は、ヘッドレス EC（Medusa v2 と Next.js 15 の [Medusa DTC Starter](https://github.com/medusajs/dtc-starter) 系）を **「既存 EC バックエンド」** として置き、[Universal Commerce Protocol (UCP)](https://github.com/Universal-Commerce-Protocol/ucp) Shopping の MCP 束縛に沿った **エージェント向け MCP サーバー**（[`b-mcp-server/`](../b-mcp-server/)）を同じデモ内で扱えるようにしたサンドボックスである。

詳細な **アクター間シーケンス**は [`sequence.md`](sequence.md)、**各 MCP Tool の入出力・例・Medusa Store API との対応**は [`mcp-reference.md`](mcp-reference.md)、ストア公開 HTTP の一覧は [`api-reference.md`](api-reference.md) を正とする。

## 目的

- **ブラウザ利用者**: `a-sandbox-ec` で商品閲覧・カート・チェックアウト・会員・注文管理まで一通り確認できる。
- **エージェント連携検討**: マーチャント側は `/.well-known/ucp` で宣言される **`services["dev.ucp.shopping"]` の MCP 用エンドポイントを 1 つ** とし、その **同一 MCP セッション**上で `tools/call` を通じてカタログ・カート・チェックアウトの各 Tool を呼び分ける、という前提（[`sequence.md` §7 の Assumptions](sequence.md#7-assumptions) と整合）。
- **規格との対応関係**: UCP の機械可読な定義は上流の [`mcp.openrpc.json`](https://github.com/Universal-Commerce-Protocol/ucp/blob/main/source/services/shopping/mcp.openrpc.json)；本デモでは [`references/ucp-shopping-mcp.openrpc.json`](../references/ucp-shopping-mcp.openrpc.json) にミラー。

注: `b-mcp-server` は **チェックアウト系 5 Tool** を中心にインメモリ実装し、環境変数が揃っている場合のみ Medusa と一部疎通する。**カタログ・カートの各 Tool は OpenRPC と `mcp-reference.md` で整理されているが、実装コード側は未搭載の場合がある**。実装状態の補足は [`mcp-reference.md`](mcp-reference.md) 冒頭および補足節を参照。

## ディレクトリ構成

```
01-sample-ucp_ap2/
├── a-sandbox-ec/                           # Medusa + Next.js モノレポ（デモ用 EC）
│   ├── package.json
│   ├── turbo.json
│   └── apps/
│       ├── backend/                        # Medusa（Store/Admin API、シード等）
│       └── storefront/                     # Next.js 15 ストアフロント
├── b-mcp-server/                           # UCP Shopping に沿った MCP（stdio）
│   └── src/server.js                       # 12 Tool 実装・Medusa 連携・AP2 Checkout JWT 生成
├── c-ai-agent-app/                         # AI エージェント UI（Express + Gemini）
│   ├── src/
│   │   ├── server.js                       # Express サーバー（/api/demo・/api/chat・/api/tokenize）
│   │   ├── shopping-flow.js                # デモ自動実行フロー（決済トークン発行ステップ含む）
│   │   └── mcp-client.js                   # b-mcp-server stdio クライアント
│   └── public/index.html                   # デモ UI（カード入力フォーム含む）
├── d-payment_handler-credential_provider/  # UCP Payment Handler + AP2 Credential Provider
│   └── src/server.js                       # POST /tokenize・/detokenize・/credential・/credential/verify
├── e-trusted_surface-wallet/               # AP2 Trusted Surface（HNP オープン Mandate 署名）
│   └── src/server.js                       # GET /jwks・/instruments  POST /open-mandate
├── references/
│   └── ucp-shopping-mcp.openrpc.json
└── zz-docs/
    ├── design-overview.md                  # 本書
    ├── sequence.md                         # UCP + AP2 HNP シーケンス
    ├── mcp-reference.md                    # MCP Tool 一覧・入力出力例
    ├── api-reference.md                    # HTTP Store / Admin と関連
    ├── state-transition.md
    └── er.md
```

## システム構成（レイヤ構造）

### 従来フロー（Human Present / UCP Stripe tokenization）

- **Human チャネル（`a-sandbox-ec`）**: Next.js が `[countryCode]` を解釈し、`@medusajs/js-sdk` で Medusa Store API を呼ぶ。ミドルウェアでリージョンとクッキー。ここは従来のヘッドレス店頭であり、**MCP と直結しない**経路でも EC を利用できる。
- **Agent チャネル（`c-ai-agent-app` + MCP）**: AI エージェントの UI アプリ（Express + Gemini）が **単一 MCP 接続**（`b-mcp-server`）で `search_catalog` / `get_product` / `lookup_catalog`、`create_cart` / `get_cart` / `update_cart` / `cancel_cart`、`create_checkout` / `get_checkout` / `update_checkout` / `complete_checkout` / `cancel_checkout` 等を順にまたは必要に応じて呼ぶ（論理順序の全体像は [`sequence.md`](sequence.md) §1〜§3）。
- **Payment Handler チャネル（`d-payment_handler-credential_provider` + Stripe）**: `create_checkout` レスポンスの `payment_handlers` config を受け取った Platform（`c-ai-agent-app`）が **MCP の外側**で `POST /tokenize` を呼び出し、UCP トークン（`ucp_tok_*`）を発行する。内部で Stripe の `paymentIntents.create` を呼び出し、PaymentIntent ID と UCP トークンを紐付けて管理する。
- **MCP と既存 EC の関係**: MCP 実装が **アダプタ**として動き、内部的に Medusa の Store API（`POST /store/carts` など）へマッピングする想定。**UCP の `Checkout` と Medusa のカート/注文は 1:1 ではなく**（[`sequence.md`](sequence.md#7-assumptions)）、フィールド対応はアダプタ設計として別問題として扱う。`complete_checkout` 時は `/detokenize` で UCP トークンを検証し、Stripe PaymentIntent を確定（`/v1/payment_intents/{id}/confirm`）してから Medusa の注文確定を呼ぶ。
- **`b-mcp-server` と Medusa**: [`mcp-reference.md`](mcp-reference.md) 冒頭の設計概要どおり、`EC_BACKEND_URL` と `EC_PUBLISHABLE_KEY` が揃っている場合、`create_checkout` の処理中などに **限定して** HTTP で Medusa と連携し、応答に `_ec_mirror` を載せられる。チェックアウト状態本体は開発用に **プロセス内メモリ**（再起動で消失）。

### AP2 HNP フロー（Human Not Present / Agentic Payment Protocol v0.2）

AP2 は、人間が不在のまま Agent が自律的に決済を完了するためのセキュリティプロトコル。MCP 認証は**クライアントクレデンシャルによるクライアント認証のみ**に限定し、ユーザー存在を前提とした認証フローは使用しない。

| コンポーネント | 役割 | AP2 ロール |
|---|---|---|
| `e-trusted_surface-wallet` | ユーザーが事前承認したオープン Mandate を署名・発行 | Trusted Surface |
| `b-mcp-server` | マーチャント署名付き Checkout JWT を生成・提供 | Merchant |
| `d-payment_handler-credential_provider` | Payment Mandate を検証し Payment Credential を発行 | Credential Provider |
| `c-ai-agent-app` | 自律的に Mandate Chain を構築・提示して購入を完了 | Shopping Agent |

**Phase 1a — ユーザー在席時（Open Mandate の委任）**

ユーザーが Shopping Agent に購入タスク（意図・制約）を設定し、Trusted Surface から署名付きオープン Mandate を取得する。Mandate には Agent の公開鍵（`cnf.jwk`）が埋め込まれ、以降は Agent のみが利用できる。

- `e-trusted_surface-wallet POST /open-mandate` → `open_checkout_mandate` + `open_payment_mandate`（両方とも `vct: mandate.*.open.1`）

**Phase 1b — Human Not Present（自律ショッピング）**

Agent は Merchant の MCP を使いカートを組み、`create_checkout` で Merchant 署名付き `checkout_jwt` を取得する。Agent は Agent 秘密鍵でクローズド Mandate（`vct: mandate.checkout.1` / `mandate.payment.1`）を生成し、オープン Mandate と連鎖させる。

- `b-mcp-server create_checkout` → `checkout_jwt` / `checkout_hash` / `merchant_jwks`

**Phase 2 — Human Not Present（自律決済）**

Agent は Payment Mandate チェーン（オープン + クローズド）を Credential Provider に提示して Payment Credential を取得し、Checkout Mandate と Credential を Merchant の MCP に渡してチェックアウトを完了する。

- `d-payment_handler-credential_provider POST /credential` → `token`（Payment Credential）
- `b-mcp-server complete_checkout` → `status: completed`

詳細なシーケンスは [`sequence.md`](sequence.md) §8（AP2 HNP フロー）を参照。

## 処理の流れ（UCP／MCP 観点の要約）

[`sequence.md`](sequence.md) と整合させた抽象は次のとおり。

### 従来フロー（UCP + Stripe）

| フェーズ | 主な MCP Tool / API（一例） | コメント |
| -------- | ---------------------- | -------- |
| 検索・詳細 | `search_catalog`、`get_product`（複数 ID は `lookup_catalog`） | `meta.ucp-agent.profile` 等、`meta` 必須（[`mcp-reference.md`](mcp-reference.md) §1）。 |
| カート | なければ `create_cart`、あり得る経路として `get_cart` → **クライアント側で行マージ** → `update_cart` | **`update_cart` はカート全体の置換**（規格）；行を失わずに足すときは現状態を読んでから送る。 |
| チェックアウト開始 | `create_checkout`、`update_checkout`、`get_checkout` | `create_checkout` レスポンスに `checkout_jwt`・`checkout_hash`（AP2）および `payment_handlers`（Stripe 連携時）が含まれる。 |
| **決済トークン発行**（MCP 外） | `d-payment_handler-credential_provider POST /tokenize` → Stripe `paymentIntents.create` | Platform が直接呼び出す。Stripe PaymentIntent を作成し UCP トークン（`ucp_tok_*`）を返す。 |
| チェックアウト完了 | `complete_checkout` | `meta.idempotency-key` 必須。`b-mcp-server` が内部で `/detokenize` → Stripe confirm → Medusa `/complete` の順に処理し、`order_id` を返す。 |

### AP2 HNP フロー

| フェーズ | API / Tool | コメント |
| -------- | ---------- | -------- |
| **オープン Mandate 取得**（HNP 前準備） | `e-trusted_surface-wallet POST /open-mandate` | Agent 公開鍵・制約を渡す。Trusted Surface がユーザー同意を得てオープン Mandate を ES256 署名して返す。 |
| ショッピング | `b-mcp-server` 各 Tool（従来と同一） | カタログ・カート操作は同じ。 |
| Checkout JWT 取得 | `create_checkout` | レスポンスに `checkout_jwt`（マーチャント ES256 署名 JWT）と `checkout_hash` が含まれる。 |
| クローズド Mandate 生成 | Agent 内部処理 | Agent は Agent 秘密鍵で `mandate.checkout.1` / `mandate.payment.1` を署名。 |
| **Payment Credential 取得** | `d-payment_handler-credential_provider POST /credential` | オープン + クローズド Payment Mandate を検証。制約評価後に Payment Credential token を発行。 |
| チェックアウト完了 | `complete_checkout` | Checkout Mandate チェーンと Payment Credential token を含めて送信。 |

役割のみの読み替え用の抽象シーケンスは [`sequence.md`](sequence.md) §4。AP2 HNP の詳細は [`sequence.md`](sequence.md) §8。

規格側の詳細リンク（カタログ・カート）は [`sequence.md`](sequence.md) の冒頭（仕様リンク群）および、リポジトリルートの [`references/specification/community/ucp/`](../../../references/specification/community/ucp/) を参照できる。

## 主要コンポーネント（`a-sandbox-ec` / HTTP）

人間向け店頭および Medusa が提供する公開 API は、変更のないサブツリー `a-sandbox-ec` が担う。

### バックエンド HTTP / 設定

- **対応**: `a-sandbox-ec/apps/backend/medusa-config.ts`
- **責務**: DB 接続、`projectConfig`（CORS、JWT / Cookie シークレット等）。

### カスタム Store / Admin ルート

- **対応**: `a-sandbox-ec/apps/backend/src/api/store/custom/route.ts`、`admin/custom/route.ts`
- **責務**: ファイルベースルーティングのサンプル GET（疎通・拡張の足場）。

### 初期データシード

- **対応**: `a-sandbox-ec/apps/backend/src/migration-scripts/initial-data-seed.ts`
- **責務**: 販売チャネル、リージョン、商品・在庫等のデモデータ投入。

### ストアフロント SDK とデータ層

- **対応**: `a-sandbox-ec/apps/storefront/src/lib/config.ts`、`lib/data/cart.ts` 等
- **責務**: JS SDK、カート ID のクッキー、`retrieveCart` / `getOrSetCart` と `revalidateTag`。

### リージョン解決ミドルウェア

- **対応**: `a-sandbox-ec/apps/storefront/src/middleware.ts`
- **責務**: `GET /store/regions` に基づく国コード・クッキー。

## MCP 共通入力・Tool と HTTP の対応（参照先）

全 Tool の入力形と Medusa の対応表は **`mcp-reference.md` に集約**されている。

- **共通 `meta`**（`ucp-agent.profile`、`complete` / `cancel` 時の `idempotency-key` など）: [`mcp-reference.md` §1](mcp-reference.md#1-共通入力meta)。
- **カタログ・カート・チェックアウトの一覧と Store API の対応**: [`mcp-reference.md` §2](mcp-reference.md#2-mcp-tool と-apireferencemdhttp-apiの対応一覧)。
- **各 Tool の説明・`arguments`/応答例**: カタログ・カート §3〜§8、チェックアウト §9〜§13。

## 主要データ（Medusa／店頭）

- **SalesChannel / ApiKey（publishable）**: ストアシードと店頭キー。
- **Region / Country / Tax**: 多地域前提。ミドルウェア・カート作成の `region_id` と関連。
- **Product / Variant / Collection / Category**: カタログ。MCP の `search_catalog` 等のアダプタ先は [`mcp-reference.md`](mcp-reference.md) §2.1。
- **Cart / LineItem**: ブラウザはクッキーでカート ID を追跡。MCP 側は `create_cart` 等が UCP 形の資源となる（Medusa と ID が同一とは限らない）。
- **Order / Customer**: 注文確定後。**UCP MCP → Medusa の注文確定**の完全自動化は実装により異なり、本デモではチェックアウト完了処理が簡略化されている点に注意。

## リクエスト／状態の流れ（ブラウザ利用）

1. 利用者が `/[countryCode]/...` にアクセスする。
2. `middleware.ts` がリージョンとクッキーを揃える。
3. Server Action 等が SDK で `retrieveCart`・商品一覧取得等を行い、必要なら `getOrSetCart` でカートを作成しクッキーに保存する。
4. チェックアウト完了後に注文が確定し、確認ページ・アカウントから参照する。

## 制約と補足

- **単一 MCP エンドポイント前提**および **認証・署名の検証が本デモで未実装な部分**については [`sequence.md` §7](sequence.md#7-assumptions) を参照。
- **カスタム HTTP**（`/store/custom` 等）はプレースホルダに近い。
- **エージェント向け MCP サーバー起動**（開発用）は [`sequence.md`](sequence.md#6-mcp-サーバーの起動開発用)および [`mcp-reference.md`](mcp-reference.md#14-起動例開発用)（`cd b-mcp-server` → `npm install` → `npm start`。任意で `EC_BACKEND_URL` と `EC_PUBLISHABLE_KEY`）。
- **Payment Handler の起動**: `cd d-payment-handler` → `npm install` → `node src/server.js`（デフォルト `:3200`）。`STRIPE_SECRET_KEY` 未設定時はモックモード（`pi_mock_*` を返す）。`c-ai-agent-app` の `.env` に `PAYMENT_HANDLER_URL=http://localhost:3200` を設定すると決済トークン発行が有効になる。

## カスタマイズの起点（人間向け店頭・バックエンド）

接続先・キー・カート処理の典型例はこれまでどおり次のファイルが起点となる。コード全文は該当ファイルを参照する。

| 領域 | 主なファイル |
| ----- | ------------- |
| Medusa SDK 接続 | `a-sandbox-ec/apps/storefront/src/lib/config.ts`、`NEXT_PUBLIC_*` |
| リージョン前処理 | `a-sandbox-ec/apps/storefront/src/middleware.ts`、`BACKEND_URL` 未設定時のエラー |
| カート取得・キャッシュ | `a-sandbox-ec/apps/storefront/src/lib/data/cart.ts` の `retrieveCart`・`getOrSetCart` |
| Medusa project 設定 | `a-sandbox-ec/apps/backend/medusa-config.ts` |
| 初期シード | `a-sandbox-ec/apps/backend/src/migration-scripts/initial-data-seed.ts` |

README にある「アカウント間の注文引き継ぎ」（`order/.../transfer/...` 等）は DTC Starter 由来の機能としてストアフロントに含まれる。
