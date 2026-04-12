# 調査レポート

## 対象Issue

- **参照**: [atakedemo/agent-commerce-research#3 — ACPの理解](https://github.com/atakedemo/agent-commerce-research/issues/3)
- **タイトル**: ACPの理解
- **概要**: データソースとして [agentic-commerce-protocol / agentic-commerce-protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) を指定し、**(1) 対象ディレクトリの構造**、**(2) 規格で定めている内容（データモデル、IF 定義、認証認可、決済手段）**、**(3) 個別調査トピック（MCP、`rfcs` 各ファイル、`Signature` ヘッダ）**、**(4) 検討状況（活発な Issue、最新リリースの範囲）** を整理することが求められている。

## 調査対象ディレクトリ

- **パス**: `insights/002-acp-research/`
- **確認したもの**: 本ディレクトリの `README.md`、および Target の参照ミラー（`README.md`、`rfcs/*.md`、`docs/mcp-binding.md`、`spec/2026-01-30/` と `spec/unreleased/` の OpenAPI・OpenRPC・JSON Schema、`changelog/`、Issue 一覧 API の先頭ページ相当）

## エグゼクティブサマリー

ACP（Agentic Commerce Protocol）は、日付版ディレクトリ（例: `2026-01-30`）でスナップショット管理される **beta** のオープン標準であり、マーチャント実装向けに **チェックアウト用 REST API** と **委任決済（Delegate Payment）API**、**Webhook 用 OpenAPI** が分離されている。認証は **Bearer（API Key 形式）** を主とし、決済は **Payment Handlers** による拡張モデルへ移行済みだが、Delegate Payment 側の資格情報は現行テキスト上 **card のみ** と明示されている。**MCP Binding**（チェックアウトを MCP Tools に写像）は **`spec/unreleased` と `docs/mcp-binding.md`** にあり、**日付版 `2026-01-30` スナップショット単体には OpenRPC が含まれない**。`Signature` ヘッダは OpenAPI 上「webhook」と短く書かれつつ、RFC では **リクエスト署名（canonical JSON・`Timestamp`）** と **Webhook の HMAC** が区別される。GitHub の「Releases」は空で版管理は **spec + changelog** が実体であり、コミュニティでは **マーケ・カート・フィード** 等の SEP が相次いで提案されている。

## Issue要約

Issue 本文では次が求められている。

- **問題 / 目的**: ACP プロトコルを理解するための整理。
- **データソース**: `https://github.com/agentic-commerce-protocol/agentic-commerce-protocol`
- **整理項目**:
  - 対象ディレクトリの構造
  - 規格内容: データモデル、IF 定義、認証認可、サポートする決済手段
  - **個別調査トピック**（[Issue #3](https://github.com/atakedemo/agent-commerce-research/issues/3) 追記）:
    1. MCP サポートの状況
    2. `rfcs/` 配下の各 Markdown で定めている内容
    3. ヘッダーにおける `Signature` パラメータの使い方
  - 検討状況: 議論が集中している Issue、最新リリースに含まれる内容
- **成功条件の追加記述**: Issue 本文上は明示されていない（調査・整理が主目的）。

## 分析

### 対象ディレクトリの構造が何を示しているか

* 公式リポジトリのルート `README.md` に、責務分離に沿ったディレクトリ案内がまとまっている（**「版スナップショット + 並行ドラフト（unreleased）」** 構造である。）
  * 人間可読の提案は `rfcs/`
  * 機械可読な版は `spec/<YYYY-MM-DD>/`（`openapi/` と `json-schema/`）
  * 同版に揃えた例が `examples/<日付>/`
  * 版ごとの変更説明が `changelog/`
  * 運用と SEP が `docs/`
* HTTP IF・JSON データモデル・説明 RFC・ガバナンスを同じリポジトリで型付きに同期させるための典型的な配置だと解釈できる。

第2階層までの俯瞰（ルート `README.md` の構造抜粋に準拠）:

```
├── rfcs/                 # 設計 RFC（チェックアウト、能力交渉、決済ハンドラ等）
├── spec/
│   ├── 2025-09-29/       # 初回スナップショット
│   ├── 2025-12-12/       # フルフィルメント強化等
│   ├── 2026-01-16/       # 能力交渉（capability negotiation）
│   ├── 2026-01-30/       # 拡張・ディスカウント・Payment Handlers（現行の Latest Stable の一つ）
│   └── unreleased/       # 開発中ドラフト
├── examples/             # 上記各版に対応する例
├── changelog/            # 版別・unreleased の変更ログ
├── docs/                 # governance, SEP, MCP binding, principles 等
├── scripts/              # 補助スクリプト
└── legal/                # CLA 等
```

### データモデルおよび IF 定義

**IF 定義** は **(1)** 機械可読な **`spec/<日付>/openapi/*.yaml`** と **(2)** 人間可読な **`rfcs/*.md`** の両方に記述がある。前者は OpenAPI 3.x が正、後者は **エンドポイント・メソッド・リクエストボディの説明**および **RFC メタの Status（Draft / Proposal 等）** を整理するために参照する。

#### 機械可読 IF（OpenAPI、`spec/2026-01-30/openapi/`）

| ステータス | IF（ファイル） | 主な操作 | 役割 |
|--------|----------------|----------|------|
| **日付版スナップショットに収録**（`2026-01-30`） | `openapi.agentic_checkout.yaml` | `POST /checkout_sessions`、`POST|GET /checkout_sessions/{id}`、`POST .../complete`、`POST .../cancel` | エージェント起点のチェックアウト・セッションライフサイクル |
| 同上 | `openapi.delegate_payment.yaml` | `POST /agentic_commerce/delegate_payment` | Allowance 付きで資格情報をトークン化しマーチャントが制限利用 |
| 同上 | `openapi.agentic_checkout_webhook.yaml` | `POST`（受信側パスはファイル内 `paths` 参照） | マーチャント→プラットフォームの注文イベント通知（`Merchant-Signature` 等） |

#### `rfcs/` に記載された IF（エンドポイント・Method・リクエストボディ）

各 RFC 先頭の **Status** と、本文で **パス・メソッド・ボディ**が明示されている箇所に基づく。**同一チェックアウト系は `rfc.agentic_checkout.md` を主とし、拡張 RFC は「既存エンドポイント上の追加フィールド」**として整理する。

| ステータス（RFC） | RFC ファイル | エンドポイント | Method | リクエストボディ（RFC 記載の要点） |
|---------------------|----------------|----------------|--------|-----------------------------------|
| Draft | `rfc.agentic_checkout.md` | `/checkout_sessions` | `POST` | `items`、`buyer`、`fulfillment_details` 等（§4.1 サブセット例）。`Idempotency-Key` は全 POST で REQUIRED。 |
| Draft | 同上 | `/checkout_sessions/{checkout_session_id}` | `POST` | `items`、`fulfillment_details`、`selected_fulfillment_options` 等（§4.2、本文は差分更新可）。 |
| Draft | 同上 | `/checkout_sessions/{checkout_session_id}` | `GET` | **本文なし**（§4.3、権威ある `CheckoutSession` を返却）。 |
| Draft | 同上 | `/checkout_sessions/{checkout_session_id}/complete` | `POST` | `payment_data`、任意 `buyer`、条件付き `authentication_result`（3DS 等、§4.4）。 |
| Draft | 同上 | `/checkout_sessions/{checkout_session_id}/cancel` | `POST` | RFC 本文では **空／省略**（§4.5）。`intent_trace` は別 RFC で拡張。 |
| Draft | `rfc.delegate_payment.md` | `/agentic_commerce/delegate_payment` | `POST` | `payment_method`（現行 **card**）、`allowance`、`billing_address`、**必須** `risk_signals`、`metadata` 等（§3.2 表）。 |
| Draft | `rfc.delegate_authentication.md` | `/delegate_authentication` | `POST` | `merchant_id`、`payment_method`、`amount` 必須；任意 `acquirer_details`、`channel`、`checkout_session_id`、`flow_preference` 等（§4.1）。 |
| Draft | 同上 | `/delegate_authentication/{authentication_session_id}/authenticate` | `POST` | `fingerprint_completion` 必須；条件付き `channel`、`challenge_notification_url` 等（§4.2）。 |
| Draft | 同上 | `/delegate_authentication/{authentication_session_id}` | `GET` | **本文なし**（§4.3、認証結果・`authentication_result` はレスポンス）。 |
| Proposal | `rfc.discovery.md` | `/.well-known/acp.json`（well-known URI） | `GET` | **本文なし**（ディスカバリ文書を返却。§ 付近の HTTP 例）。 |
| Proposal | `rfc.capability_negotiation.md` | `/checkout_sessions` ほかチェックアウト系 | `POST` / `GET` | **Create** リクエストに **`capabilities` 必須**（例: `interventions`）。Update / Complete もリクエストに `capabilities` を載せ得る。レスポンスの `capabilities` は交差結果（§4.4）。 |
| Proposal | `rfc.affiliate_attribution.md` | `/checkout_sessions`、`/checkout_sessions/{id}/complete` | `POST` | それぞれ **`affiliate_attribution` をオプションで付加**（ファーストタッチ／ラストタッチ、§4.3）。 |
| Proposal | `rfc.intent_traces.md` | `/checkout_sessions/{checkout_session_id}/cancel` | `POST` | **オプション**で `intent_trace`（`reason_code`、`trace_summary`、`metadata` 等、§3.2）。 |
| Draft | `rfc.extensions.md` | `/checkout_sessions`（チェックアウト作成・更新） | `POST` | `capabilities.extensions[]` による拡張宣言（フレームワーク）。具体ペイロードは拡張ごと。 |
| Draft | `rfc.discount_extension.md` | チェックアウト create/update のリクエスト | `POST` | 拡張有効時 **`discounts.codes`**（create/update）、応答側に `discounts.applied` / `rejected`（RFC 本文・スキーマ参照）。 |
| Draft | `rfc.payment_handlers.md` | （新規パスは定義しない） | — | **`POST /checkout_sessions` 等の既存フロー**内で `capabilities.payment.handlers` と **`POST /agentic_commerce/delegate_payment`** を組み合わせる運用を記述。 |
| Draft | `rfc.seller_backed_payment_handler.md` | 同上＋`/agentic_commerce/delegate_payment`、`.../complete` | `POST` | ハンドラ宣言は `CheckoutSession`；実体は **delegate_payment と complete** の組合せ（RFC 内フロー記述）。 |
| Draft | `rfc.orders.md` | （新規 REST エンドポイントは定義しない） | — | 既存 **`Order` スキーマ**のポスト購入フィールド拡張（Webhook 等のペイロード想定）。 |

**補足**: `rfc.agentic_checkout.md` §2.3 は **Webhook を別 OAS/RFC** に委ねる。**Webhook のパス・`Merchant-Signature`** は **`openapi.agentic_checkout_webhook.yaml`** が機械可読 IF。RFC 単体ではパス文字列まで固定していない。

**データモデル** は同名版の `json-schema/` に `schema.agentic_checkout.json`（セッション・注文等の中心）、`schema.delegate_payment.json`、`schema.discount.json`、`schema.extension.json` として分かれている。チェックアウトは `CheckoutSession` を権威ある状態として返し、完了時に `CheckoutSessionWithOrder` で注文を束ねる形が OpenAPI 上の構造と整合する。

### 認証認可

`openapi.agentic_checkout.yaml` では **グローバル `security: [bearerAuth: []]`** とし、`components.securitySchemes.bearerAuth` で **HTTP Bearer（bearerFormat: API Key）** を定義している。リクエストごとに `Authorization` ヘッダ（必須、`Bearer api_key_123` 例）と **必須の `API-Version`（YYYY-MM-DD）**、任意の `Idempotency-Key` / `Request-Id` / `Signature` / `Timestamp` などがパラメータとして繰り返し参照される。

`Signature` / `Timestamp` の説明は **「Webhook 検証向け」** のニュアンスで記載されているが、チェックアウトの各オペレーションの parameters にも含まれる。**エンドユーザの OAuth フローそのものを OpenAPI が包括的に定義するのではなく、マーチャント API へのサーバ間アクセス制御と相関・リプレイ対策のフックを提供する** という分解になっている。

買い手側の状態として、`Buyer` スキーマには `authentication_status`（`authenticated` / `guest` / `requires_signin`）が存在し、セッションは `authentication_required` 等のステータスを取り得る。決済介入（例: 3DS）向けに `authentication_metadata` や 3DS 結果オブジェクトが定義されており、**「ログイン」ではなく主に決済系の強認証介入** と読める。

### サポートする決済手段

`changelog/2026-01-30.md` では **Payment Handlers フレームワーク** が導入され、`capabilities.payment.handlers` で **名前・version・spec URL・PSP・delegate / PCI 要件・instrument schema** などを構造化する方針が示されている。サンプルとしてカード（ブランド交渉、3DS 等）が中心に登場する。

一方、`openapi.delegate_payment.yaml` の説明では **「現在サポートする資格情報タイプは card のみ」** と明示されている。つまり **プロトコル全体としてはハンドラによる拡張余地を規定しつつ、Delegate Payment のコア記述はカード前提** であり、他手段はハンドラ/実装側の追従が必要な領域として残る。

### 状態管理・セッション管理

* `CheckoutSession` / `CheckoutSessionBase` の `status` は、少なくとも次の列挙でライフサイクルが表現される
  * `incomplete`
  * `not_ready_for_payment`
  * `requires_escalation`
  * `authentication_required`
  * `ready_for_payment`
  * `pending_approval`
  * `complete_in_progress`
  * `completed`
  * `canceled`
  * `in_progress`
  * `expired`
* 作成・更新・完了・取消の各エンドポイントと、表示用 `messages[]`、介入用 `capabilities`、期限 `expires_at` が組み合わさり、**サーバ権威のセッション状態機械**として設計されている。

OpenAPI は遷移表を 1 枚の表で固定していないため、下図は **列挙値とエンドポイントの意味から整理した概念上の状態遷移**である。実装ごとに到達し得る辺が異なり、失敗経路や `expired` の扱いもセラー実装に依存する。

```mermaid
stateDiagram
    [*] --> incomplete: POST /checkout_sessions

    incomplete --> in_progress: POST …/checkout_sessions/{id}（更新）
    in_progress --> incomplete: セラーが状態を戻す例

    in_progress --> not_ready_for_payment: 支払不能条件
    not_ready_for_payment --> in_progress: 更新で再計算

    in_progress --> requires_escalation: 人手対応が必要
    requires_escalation --> in_progress: 解消後に再開

    in_progress --> authentication_required: 3DS 等
    authentication_required --> ready_for_payment: 認証完了

    in_progress --> ready_for_payment: 条件充足
    not_ready_for_payment --> ready_for_payment: 条件充足

    ready_for_payment --> pending_approval: B2B 承認等
    pending_approval --> ready_for_payment: 承認済み

    ready_for_payment --> complete_in_progress: POST .../complete
    complete_in_progress --> completed: 注文確定（成功）

    incomplete --> canceled: POST .../cancel
    in_progress --> canceled
    ready_for_payment --> canceled
    pending_approval --> canceled

    incomplete --> expired: expires_at 超過等
    in_progress --> expired
    not_ready_for_payment --> expired
    requires_escalation --> expired
    authentication_required --> expired
    ready_for_payment --> expired
    pending_approval --> expired
    complete_in_progress --> expired

    completed --> [*]
    canceled --> [*]
    expired --> [*]
```

### 検討状況（Issue）と最新リリースの含意

GitHub API 上、当該リポジトリには **GitHub Releases（タグ）が存在せず**、「最新リリース」は **最新の日付版ディレクトリ + `changelog/<日付>.md`** が実体になる。

`issues?state=all&sort=updated` のRecently updated には、少なくとも次のような **SEP / proposal 系** が同居し、議論の密度が高いテーマが読み取れる。

- **チェックアウト UX / 法令・マーケ**: Marketing Consent on Checkout Complete（Issue/PR 番号 195, 199 付近）
- **表現・相互運用**: Markdown（CommonMark）コンテンツ仕様（例: 212 付近）
- **購入前体験**: Cart Capability、Default Delivery Option、Suggested Pricing、Fulfillment Details on Complete など
- **カタログ・販促**: Product Feeds、Promotions API など
- **運用**: TSC ドキュメント、OpenAPI 検証の chore、CLA 追加

直近の **changelog で固め済み（2026-01-30）** の柱は、能力交渉、Payment Handlers（破壊的変更）、拡張フレームワークとディスカウント拡張、関連する OpenAPI / JSON Schema / 例の更新に要約できる。上記の多くの SEP は **`unreleased` 側や Issue 段階** にあり、次版スナップショット待ち、またはスポンサー承認待ち、という状態が混在する。

#### Issue コメント追補（追加調査観点）

[Issue #3 のコメント（2026-04-05）](https://github.com/atakedemo/agent-commerce-research/issues/3#issuecomment-4188370376) で、**(1) `Signature` で検証可能な内容**、**(2) 口座振替・PayPay・QuickPay 等の他決済をどう拡張するか** が追加された。以下、当該観点に沿った調査結果である。

##### （1）`Signature` で検証可能な内容

ACP では **「Signature」という名前のヘッダが複数系統**あり、**検証で保証できること**が系統ごとに異なる。

| 系統 | 典型ヘッダ | 検証で主に保証できること（仕様ベース） | 検証に使う素材 |
|------|------------|----------------------------------------|----------------|
| **エージェント→マーチャント REST** | `Signature`（`rfc.agentic_checkout.md` 等） | **canonical JSON 化したリクエスト本文**の **改ざん検知**、送信者の **非対称鍵**に紐づく **身元**（公開鍵が帯域外で共有されている前提）、**`Timestamp` との組合せ**による **リプレイの抑制**（bounded skew で SHOULD 検証）。 | 受信側は **クライアント公開鍵**＋アルゴリズム方針（帯域外）。 |
| **エージェント→PSP `delegate_payment`** | `Signature`（`rfc.delegate_payment.md`） | **委任トークン化リクエスト**の本文整合性・送信者身元（detached 署名、**MUST** 記述）。 | 同上（クライアント秘密鍵／サーバは公開鍵）。 |
| **マーチャント→プラットフォーム Webhook** | **`Merchant-Signature`**（`openapi.agentic_checkout_webhook.yaml`。**HTTP `Signature` ではない**） | **raw リクエストボディ**の **改ざん検知**、**共有秘密**を知る送信者のみが生成可能な **HMAC**、**タイムスタンプ `t`** による **リプレイ窓**（例: 許容 ±300 秒）。`changelog/unreleased/webhook-signing-stripe-format.md` では **Stripe の Webhook 署名方式**との互換を明示する。 | 受信者は **Webhook 共有秘密**（`Merchant-Signature` の HMAC 検証）。 |

**Stripe との対応**（コメントの「逆算」参照）: [Stripe Webhooks — Signatures](https://stripe.com/docs/webhooks/signatures) では、署名ペイロードに **`timestamp` と body を結合**し、**共有秘密**で HMAC を計算して送信者正当性と **ペイロード完全性** を確認する。ACP の unreleased changelog は **「`t=<unix>,v1=<hex>`、`timestamp + '.' + raw_body` に HMAC-SHA256」** と [Stripe のパターン](https://stripe.com/docs/webhooks/signatures) に揃える旨を記載している。よって **Webhook 側**で検証できるのは主に **(a) 本文が改ざんされていないこと (b) 共有秘密を持つマーチャントが送ったこと (c) タイムスタンプが許容ウィンドウ内であること**（リプレイ攻撃の抑止）である。

一方、**REST の `Signature`（非対称）**で検証できるのは **本文の整合性と鍵ペアに紐づくクライアント身元**であり、**Webhook の HMAC と同じ数学的構造ではない**（レポートの「### 個別調査トピック」§3 も参照）。

##### （2）他の決済（口座振替、PayPay、QuickPay 等）— 設定できる内容と拡張の仕方

**コアの考え方**（`rfc.payment_handlers.md`）: 新しい決済手段は **新しい HTTP エンドポイントを増やすのではなく**、**Payment Handler** として **`handler` の `name`・`version`・`spec`・`config_schema`・`instrument_schemas`・`config`** を宣言し、**`capabilities.payment.handlers`** で交渉する。**`delegate_payment` の 1 エンドポイント**は維持し、**`payment_method` の形態**（oneOf / 判別子）を拡張する設計が基本である。

**追加パラメータの置き場所**（対象エンドポイント別の整理）:

| 対象エンドポイント | 内容 | 具体例 |
|--------|------|--------|
| `POST /checkout_sessions`<br>`GET /checkout_sessions/{checkout_session_id}`<br>`PATCH /checkout_sessions/{checkout_session_id}`（`CheckoutSession` 応答） | 小売店・ECがサポートする手段<br>PSP<br>**スキーマ URL**<br>**delegate 要否** | `requires_delegate_payment`<br>`config`（ネットワーク、通貨、merchant_id 等） |
| `POST /agentic_commerce/delegate_payment` | 資格情報の **instrument**（`payment_method`）と **Allowance**、**risk_signals** | カードは現行どおり、別手段は **新しい `type` 分岐** と **payload スキーマ** |
| `POST /checkout_sessions/{checkout_session_id}/complete` | **`payment_data`**（`handler_id`＋instrument 等）は **2026-01-30** 以降の Payment Handlers モデルに統合 | ハンドラごとに **instrument の必須フィールド** が異なる |

**抽象化と具体化**: プロトコルは **「ハンドラ ID + スキーマ参照 + delegate 可否」** を抽象化し、**口座振替・ウォレット・QR** 等の**国・事業者固有**の項目は、**ハンドラ仕様書（`spec` URL）と JSON Schema** に具体化するのが意図される。
* `rfc.capability_negotiation.md` ： `bank_transfer.ach` / `bank_transfer.sepa` 等の **識別子の例** があり
* `rfc.payment_handlers.md` ：**`dev.acp.tokenized.bank_transfer` — Bank transfers (open for extension)** として **プレースホルダ** が登場する。

**参考 PR：x402の追加提案**:
**決済手段追加の実例**として **`payment_method.type: crypto`** と **`x402_payload`** を **`delegate_payment`** に載せ、**ウォレット署名**を **facilitator** が検証して **SPT**（共有トークン）を発行する流れを定義する。**口座振替・QR 等も同様に**、「**新ハンドラ名 + 新 instrument スキーマ + delegate_payment の oneOf 拡張**」で足す設計が、**抽象（共通）と具体（手段別）**の分離の手本になる。
* [PR #111 — SEP: Crypto Payment Method (x402-based)](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/111)
* [Issue #109](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/109)



##### `POST /agentic_commerce/delegate_payment`

**リクエストパラメータ**（OpenAPI 上は path/query なし。ヘッダは `Authorization`、`Content-Type`、`API-Version`、`Signature` / `Timestamp` 等を参照）:

```
Authorization: Bearer <access_token>
Content-Type: application/json
API-Version: <version>
```

**リクエストボディ**（`payment_method.type: crypto` と `x402_payload`）:

<details>

```json
{
  "payment_method": {
    "type": "crypto",
    "x402_payload": {
      "x402Version": 2,
      "accepted": {
        "scheme": "exact",
        "network": "eip155:8453",
        "amount": "5000000",
        "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "payTo": "0x...",
        "maxTimeoutSeconds": 300
      },
      "payload": {
        "signature": "0x...",
        "authorization": {
          "from": "0xUserWallet...",
          "to": "0xFacilitator...",
          "value": "5000000",
          "validAfter": 0,
          "validBefore": 1707400000,
          "nonce": "0x..."
        }
      }
    }
  },
  "allowance": {
    "reason": "one_time",
    "max_amount": 500,
    "currency": "usd",
    "checkout_session_id": "cs_01HV3P3...",
    "merchant_id": "acme",
    "expires_at": "2025-02-05T12:00:00Z"
  },
  "risk_signals": [
    { "type": "crypto_wallet_risk", "score": 5, "action": "authorized" }
  ],
  "metadata": {}
}
```

</details>

##### `POST /checkout_sessions/{checkout_session_id}/complete`

**リクエストパラメータ**（パス）:

```
checkout_session_id = cs_01HV3P3...
```

**リクエストパラメータ**（OpenAPI で参照されるヘッダの例）:

```
Authorization: Bearer <access_token>
Content-Type: application/json
API-Version: <version>
```

**リクエストボディ**（Issue #109 は **checkout 完了時の `payment_data` がカードと同様に SPT のみ**と明記。`credential.type: spt`）:

```json
{
  "payment_data": {
    "credential": {
      "type": "spt",
      "token": "vt_01J8Z3WXYZ9ABC"
    }
  }
}
```

##### `POST /checkout_sessions` / `GET /checkout_sessions/{checkout_session_id}` / `PATCH /checkout_sessions/{checkout_session_id}`（Payment Handler 宣言の「指定」— 応答）

Issue #109 §7 は **セラーが crypto を広告する**ときの **Payment Handler オブジェクト**を、**`CheckoutSession` に含まれるハンドラ一覧**として示している（**クライアントが送るリクエストボディではない**）。指定の形の例:

<details>

```json
{
  "id": "handler_crypto_001",
  "name": "dev.acp.crypto",
  "version": "2025-02-05",
  "spec": "https://acp.dev/handlers/crypto",
  "requires_delegate_payment": true,
  "requires_pci_compliance": false,
  "psp": "stripe",
  "config": {
    "method": "crypto",
    "currency": "USDC",
    "network": ["eip155:8453", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"]
  }
}
```

</details>

### 個別調査トピック（Issue 追補）

以下は [Issue #3 — 個別調査トピック](https://github.com/atakedemo/agent-commerce-research/issues/3) に照らした追加整理である。根拠はミラー上の `docs/`・`rfcs/`・`spec/unreleased/` および各 RFC 本文。

#### 1. MCP サポートの状況

- **位置づけ**: MCP（Model Context Protocol）は ACP にとって **REST に並ぶ第2のトランスポートBinding** として文書化されている（[`docs/mcp-binding.md`](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/docs/mcp-binding.md)）。REST のセマンティクス・JSON Schema は変えず、チェックアウト操作を **MCP の Tools（JSON-RPC 2.0／Streamable HTTP）** に写像する **追加仕様** である。
- **機械可読定義**: `spec/unreleased/openrpc/openrpc.agentic_checkout.json` が **5 つの MCP ツール**（create / get / update / complete / cancel）を OpenRPC で定義する。一方、**日付版スナップショット `spec/2026-01-30/` には OpenRPC が含まれていない**（ミラー上は OpenAPI と JSON Schema のみ）。即ち **MCP Bindingは現行の「リリース済み日付フォルダ」より開発ライン（unreleased）側に存在** する。
- **ディスカバリとの接続**: [`rfcs/rfc.discovery.md`](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/rfcs/rfc.discovery.md) および JSON Schema 上の `transports` は `rest` と `mcp` を列挙し得る旨が述べられ、[SEP #135](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/135)（MCP Transport Binding）と相互参照される。
- **チェンジログ**: `changelog/unreleased/mcp-transport-binding.md` で OpenRPC・`docs/mcp-binding.md`・MCP 用例 JSON の追加が **Added** として記録されている。
- **未カバー（仕様上の明示）**: `docs/mcp-binding.md` は **Delegate Payment の MCP Bindingはフォローアップ SEP** に委ねるとし、現行Bindingは **Agentic Checkout IFのみ** としている。

#### 2. `rfcs/` 配下の各 Markdown で定めている内容

`rfcs/` はサブディレクトリを持たず、**各ファイルが RFC（設計・根拠・スコープ）を 1 トピック単位で固定**する。OpenAPI / JSON Schema の**ノルマティブな置換**ではなく、仕様の意図と交互参照の軸になる。

| ファイル | 定めていること（要点） |
|----------|------------------------|
| `rfc.agentic_checkout.md` | **Agentic Checkout（マーチャント REST）** のライフサイクル、Webhook、推奨ヘッダ（`Signature` **`base64url`・RECOMMENDED**、**canonical JSON**＋`Timestamp`）、**リクエスト署名と鮮度検証（SHOULD）**、Webhook 側は別途 **HMAC（`Merchant-Signature`）** との区別。 |
| `rfc.delegate_payment.md` | **委任決済** 1 エンドポイント、Allowance、`Signature` **`base64url` の detached 署名を MUST**（canonical JSON 上の整合性）。 |
| `rfc.delegate_authentication.md` | **委任認証（3DS2・ブラウザ等）** の API。`Signature` は **`base64url`・REQUIRED**、検証は **MUST**。 |
| `rfc.capability_negotiation.md` | **`capabilities` 交差**によるエージェント／セラー間の能力宣言と不整合の早期検出。 |
| `rfc.payment_handlers.md` | **Payment Handlers** フレームワーク（宣言・delegate／PCI・instrument schema 等）。 |
| `rfc.seller_backed_payment_handler.md` | **`dev.acp.seller_backed.*`** パターン（保存カード・ギフトカード等をセラー側で解決）。 |
| `rfc.extensions.md` | **ACP 拡張の枠組み**（能力交渉と連動したオプション機能）。 |
| `rfc.discount_extension.md` | **ディスカウント拡張**（コード・適用結果・自動割引・エラーコード）。 |
| `rfc.discovery.md` | **`/.well-known/acp.json`** による能力・版・`transports`（`mcp` 含み得る）の事前取得。 |
| `rfc.affiliate_attribution.md` | **`affiliate_attribution`** オブジェクトによるアフィリエイト帰属。 |
| `rfc.intent_traces.md` | **キャンセル時のインテントトレース**（放棄理由の構造化）。 |
| `rfc.orders.md` | **注文スキーマのポスト購入拡充**（フルフィルメント・調整等）。 |

#### 3. ヘッダーにおける `Signature` パラメータの使い方

**OpenAPI（チェックアウト）** では `components.parameters.Signature` が **`in: header`・`required: false`** で、**説明文は「HMAC signature for webhook verification」** に限っており、**リクエスト署名のアルゴリズム・ペイロード・鍵運用は OpenAPI のこの 1 行では確定しない**（Webhook の `Merchant-Signature` 形式と混同しやすい表現になっている）。

**RFC 側の整理（チェックアウト＝`rfc.agentic_checkout.md`）** は次のとおり読み分けられる。

- **エージェント→マーチャントの REST リクエスト**: **`Signature` は `base64url` で RECOMMENDED**。**canonical JSON** 上に署名し、**`Timestamp`（RFC 3339）と組み合わせて鮮度を bounded skew で SHOULD 検証**。**許容アルゴリズムは帯域外で公開する**想定。
- **Webhook（マーチャント→プラットフォーム）**: RFC では **別物**として明示され、**`Merchant-Signature` の HMAC 検証**を参照（OpenAPI `openapi.agentic_checkout_webhook.yaml` 側で Stripe 型 `t=...,v1=...` と raw body の HMAC-SHA256 等が定義される流れと整合）。**この経路では `Signature` ヘッダは使われない**。

**他 API の `Signature`（同一ヘッダ名・意味はIFごとに異なる）**:

- **`rfc.delegate_payment.md`**: クライアントは **detached 署名を MUST**・`base64url`。
- **`rfc.delegate_authentication.md`**: **`Signature` REQUIRED**、canonical JSON＋`Timestamp` の **MUST 検証**。

**場面別整理: 署名対象データと秘密鍵（調査結果）**

RFC は **アルゴリズム（Ed25519 / ES256 等）を帯域外で公開する**前提が繰り返される。以下の **「署名対象」** は、各 RFC にある **canonical JSON シリアライズ**（または **detached 署名**としてそれに対応するバイト列）を指す。informative として RFC 8785（JCS）に言及があるが、**ノルマティブなカノニカライズ手順の完全な固定**は本文だけでは細部まで特定できない。

| 場面 | 誰が `Signature` を付けるか（呼び出し側） | 署名の対象となるデータ | 署名に用いる秘密情報（鍵）の所在 | 検証側と公開素材 |
|------|------------------------------------------|------------------------|----------------------------------|-------------------|
| **Agentic Checkout（REST）** — `POST` 系（create / update / complete / cancel） | RFC 上の **Client**（§3.1 は「**sent by ChatGPT**」）。実装では **エージェント面の統合クライアント**が相当。 | **HTTP リクエストの JSON 本文**を canonical JSON 化したデータに対する署名。**`Timestamp` は別ヘッダ**で鮮度検証に用いる。 | **呼び出し側が保持する非対称秘密鍵**（クライアント署名）。 | **マーチャント（受信サーバ）** が **帯域外で公開されたクライアント公開鍵**等で検証 **SHOULD**（`Timestamp` は bounded clock skew）。 |
| **Agentic Checkout（REST）** — `GET .../checkout_sessions/{id}` | 同一 RFC でヘッダ集合に `Signature` が列挙されるが、**本文なし GET の canonical 対象は RFC 抜粋内にノルマティブに定義されていない**。 | （不確定）**空本文**や **メソッド＋パス等**を含む規約は **仕様外**でプロファイル化が要る可能性。 | クライアント側秘密鍵を **一般的なリクエスト署名**として想定する記述はあるが、GET の対象は未特定。 | マーチャント。 |
| **Delegate Payment** — `POST /agentic_commerce/delegate_payment` | **Client**（トークン化リクエスト送信者。文脈上 **エージェント／ウォレット／決済面クライアント**が該当しうる）。 | **リクエスト本文**を canonical JSON 化したものへの **detached 署名**（`payment_method`・`allowance` 等を含む）。 | **その Client の非対称秘密鍵**（RFC **「its private key」**）。 | **Delegate Payment サーバ**が **帯域外の公開鍵・許容アルゴリズム**で検証 **SHOULD**。 |
| **Delegate Authentication** | **クライアント**（認証 API を呼ぶアプリ／エージェント）。 | **canonical JSON** 化した **リクエスト本文**（**identity verification over canonical request**）。 | **クライアントの非対称秘密鍵**。 | **認証プロバイダ（サーバ）** が整合性を **MUST 検証**。 |
| **MCP（Checkout ツール）** | **MCP クライアント**（ツール呼び出し送信者）。 | HTTP における `Signature` は **`meta.signature`** に対応。**セマンティクスは REST の protocol メタ＋`payload` と揃える**が、**署名対象バイト列を HTTP のどの合成と完全一致させるかは `docs/mcp-binding.md` のヘッダ写像以上には本文で固定されていない**。 | `meta.signature` を送るなら **クライアント側の署名鍵素材**（Request signing）。 | **MCP サーバ**（マーチャント REST プロキシなら下流との **鍵・検証責務の割当**は実装依存）。 |

**Webhook 対照（`Signature` ヘッダではない）**: **`Merchant-Signature`**。対象は **`timestamp + "." + raw_body`**（OpenAPI）。**HMAC-SHA256 と共有秘密**。**マーチャントと受信者が事前共有**する対称鍵であり、上表の **クライアント非対称秘密鍵とは別系統**。

**MCP Binding（`docs/mcp-binding.md`）**: HTTP の `Signature` は **`meta.signature` に対応**（Required: **No**、注記は **Request signing**）。**`Authorization` は `meta` に載せず** MCP 接続レベルで扱う。

**調査上の注意**: 実装では **「どの相手が・どの本文に・どのアルゴリズムで `Signature` を付けるか」はIF（Checkout / Delegate Payment / Delegate Authentication）で要件が異なる**。チェックアウト OpenAPI の「webhook」記述だけを **購読者向け REST の署名仕様**と読み替えない方がよい。**GET の署名対象**および **MCP の `meta.signature` の正確なオクテット列**は、**プロファイルまたは今後の明文化**に期待が残る。

## 未解決事項・不足情報

- **GitHub Releases / タグが空** のため、「最新リリース」を Git の tag として機械的に指すことはできない。運用上の「latest stable」は README と `spec/2026-01-30` の位置づけに依存する。
- 本調査は **リポジトリの公開テキストと Issue 一覧** に基づく。**Discussion の要約やメンテナ毎の公式優先度付けは未実施**（open 一覧の機械的分類は `open-issues-filtered.md` を参照）。
- `Signature` / `Timestamp` をチェックアウト操作にまで要求するかは、実装プロファイル次第であり、OpenAPI 上は `required: false` と **parameters での参照** にとどまる部分がある。**チェックアウト OpenAPI の `Signature` 説明が「webhook」中心で、RFC（`rfc.agentic_checkout.md`）のリクエスト署名説明と字面が一致しない**。**統合ガイドまたは実装者向けの署名プロファイル**で是正されるかは未確認。
- **本文の無い `GET /checkout_sessions/{id}`** で **`Signature` をどのバイト列に対して計算するか** は、`rfc.agentic_checkout.md` の引用範囲では **ノルマティブに確定しない**。MCP の **`meta.signature`** も **HTTP 変換時の正確な署名対象**は OpenRPC／binding 本文だけでは完全には固定されない。

## 次のアクション

- 実装を追う場合は **OpenAI / Stripe の実装ドキュメント**（公式 README 記載のリンク）と、`spec/2026-01-30` を突き合わせる。
- 決済手段のロードマップは **`rfcs/rfc.payment_handlers.md` と Delegate Payment OpenAPI の差分**、および Payment 関連 open Issue を定期追跡する。
- 次版取り込み予定のテーマは **`changelog/unreleased/` と `spec/unreleased/`** をウォッチする。
- **実施済み（2026-04-05）**: open Issue/PR の一覧と **暫定優先度（P1–P3）** を `insights/002-acp-research/open-issues-filtered.md` に記録した。当該リポジトリでは **SEP 用の GitHub ラベルは付与されておらず**、API 上も open 93 件では `labels` が空だったため、**タイトル（`SEP:` / `[SEP]` 等）とキーワード**で近似分類している。環境に `gh` がある場合のラベルフィルタ例も同メモに併記した。

## 参照ファイル

- `insights/002-acp-research/README.md`
- `insights/002-acp-research/open-issues-filtered.md`（open Issue/PR 一覧・暫定優先度・`gh` 例）
- （Target）`https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/README.md`
- （Target）[`docs/mcp-binding.md`](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/docs/mcp-binding.md)、`spec/unreleased/openrpc/openrpc.agentic_checkout.json`（個別調査: MCP）
- （Target）`rfcs/rfc.agentic_checkout.md`、`rfc.delegate_payment.md`、`rfc.delegate_authentication.md`（個別調査: `Signature`）
- （Target）`spec/2026-01-30/openapi/openapi.agentic_checkout.yaml`、同 `openapi.delegate_payment.yaml`
- （Target）`changelog/2026-01-30.md`、`changelog/unreleased/mcp-transport-binding.md`
- （調査観点）[Issue #3 コメント #4188370376](https://github.com/atakedemo/agent-commerce-research/issues/3#issuecomment-4188370376)（`Signature` 検証可能範囲・他決済拡張）
- （Target）`changelog/unreleased/webhook-signing-stripe-format.md`（Webhook `Merchant-Signature` の Stripe 整合）
- （Target）[PR #111](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/111) / [Issue #109](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/109)（crypto / x402 決済手段追加の例）

## 主要ファクト

- Target リポジトリの説明では ACP は **OpenAI と Stripe が保守する beta** の相互作用モデルである（ルート `README.md`）。
- 版管理は **Git tag ではなく `spec/<YYYY-MM-DD>/` + `changelog/`** を主とし、`unreleased` が開発ライン（ルート `README.md`）。
- チェックアウト API は **4 系統の path**（create / update+get / complete / cancel）でセッションを操作する（`openapi.agentic_checkout.yaml`）。
- セッション `status` は **11 値の列挙**で、支払準備・介入・完了・失効などを表す（同一 OpenAPI `CheckoutSessionBase`）。
- API メタとして **Bearer 認証** と **必須 `API-Version` ヘッダ** が定義されている（同一ファイル `securitySchemes` / `parameters`）。
- Delegate Payment は **`POST /agentic_commerce/delegate_payment`** で、`allowance` と `payment_method` を受け、**現行仕様テキストでは資格情報種別は card のみ**（`openapi.delegate_payment.yaml`）。
- 2026-01-30 の変更ログでは **Capability Negotiation**、**Payment Handlers（破壊的変更）**、**Extensions + Discount 拡張** が主要機能として列挙されている（`changelog/2026-01-30.md`）。
- GitHub API 上 **releases と tags の配列は空** であり、版の「公式な打ち出し」は changelog と spec ディレクトリに寄せられている。
- Issue 一覧（更新日時ソートの先頭付近）では **マーケティング同意、CommonMark、カート、プロダクトフィード／プロモーション、配送デフォルト** などが続けて提案されている（GitHub REST issues 応答）。
- 2026-04-05 時点の **open Issue/PR 93 件**では **GitHub `labels` が 1 件も付いていない** API 応答であった。`open-issues-filtered.md` に全件表と **P1–P3 の暫定優先度**、SEP らしいタイトルの抜粋を残している。
- **MCP**: `docs/mcp-binding.md` と `spec/unreleased/openrpc/` で **Checkout の 5 操作を MCP Tools に対応付け**；`spec/2026-01-30/` には **OpenRPC が無い**（ミラー上）。
- **`rfcs/`**: 少なくとも **12 本**の RFC が **チェックアウト・委任決済／認証・能力交渉・ハンドラ・拡張・ディスカバリ等**を人間可読に分割定義。
- **`Signature`**: チェックアウト RFC では **canonical JSON＋`Timestamp`・アルゴリズムは帯域外**で **RECOMMENDED**；Delegate Authentication では **REQUIRED**；Delegate Payment では detached **MUST**；Webhook 側は **`Merchant-Signature`（HMAC）** が別系統。OpenAPI の `Signature` ヘッダ説明は **webhook 用文言**に寄せられており RFC と短絡できない。
- **`Signature` 場面別（鍵と対象）**: **Checkout／Delegate Payment／Delegate Authentication の送信者**は **自らの非対称秘密鍵**で、主に **canonical JSON 化したリクエスト本文**（DP は **detached**）に署名する前提。**検証側**は **受信サーバが帯域外の公開鍵方針**で検証（Auth は **MUST**、他は **SHOULD** 等、RFC による）。**Webhook** は **`Signature` ではなく `Merchant-Signature`** で **`timestamp + "." + raw_body`** に **共有秘密の HMAC**。
- **Issue #3 コメント追補（2026-04-05）**: **`Signature`（非対称）**と **`Merchant-Signature`（HMAC・共有秘密）** は検証できる性質が異なる；後者は unreleased changelog で **Stripe Webhook 署名**に揃える記述がある。**口座振替・ウォレット等**は **Payment Handlers＋`delegate_payment` の手段別拡張**が基本で、**PR #111（x402 / crypto）** がそのパターンの一例。
