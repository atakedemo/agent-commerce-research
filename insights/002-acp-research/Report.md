# 調査レポート

## 対象Issue

- **参照**: [atakedemo/agent-commerce-research#3 — ACPの理解](https://github.com/atakedemo/agent-commerce-research/issues/3)
- **タイトル**: ACPの理解
- **概要**: データソースとして [agentic-commerce-protocol / agentic-commerce-protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) を指定し、**(1) 対象ディレクトリの構造**、**(2) 規格で定めている内容（データモデル、IF 定義、認証認可、決済手段）**、**(3) 検討状況（活発な Issue、最新リリースの範囲）** を整理することが求められている。

## 調査対象ディレクトリ

- **パス**: `insights/002-acp-research/`
- **確認したもの**: 本ディレクトリの `README.md`、および Target リポジトリの公開ファイル（`README.md`、`spec/2026-01-30/openapi/*.yaml`、`changelog/2026-01-30.md`、Issue 一覧 API の先頭ページ相当）

## エグゼクティブサマリー

ACP（Agentic Commerce Protocol）は、日付版ディレクトリ（例: `2026-01-30`）でスナップショット管理される **beta** のオープン標準であり、マーチャント実装向けに **チェックアウト用 REST API** と **委任決済（Delegate Payment）API**、**Webhook 用 OpenAPI** が分離されている。認証は **Bearer（API Key 形式）** を主とし、決済は **Payment Handlers** による拡張モデルへ移行済みだが、Delegate Payment 側の資格情報は現行テキスト上 **card のみ** と明示されている。GitHub の「Releases」は空で版管理は ** dated spec + changelog** が実体であり、コミュニティでは **マーケティング同意・カート能力・プロダクトフィード／プロモーション・Markdown 表現** などが相次いで提案されている。

## Issue要約

Issue 本文では次が求められている。

- **問題 / 目的**: ACP プロトコルを理解するための整理。
- **データソース**: `https://github.com/agentic-commerce-protocol/agentic-commerce-protocol`
- **整理項目**:
  - 対象ディレクトリの構造
  - 規格内容: データモデル、IF 定義、認証認可、サポートする決済手段
  - 検討状況: 議論が集中している Issue、最新リリースに含まれる内容
- **成功条件の追加記述**: Issue 本文上は明示されていない（調査・整理が主目的）。

## 分析

### 対象ディレクトリの構造が何を示しているか

公式リポジトリのルート `README.md` に、責務分離に沿ったディレクトリ案内がまとまっている。人間可読の提案は `rfcs/`、機械可読な版は `spec/<YYYY-MM-DD>/`（`openapi/` と `json-schema/`）、同版に揃えた例が `examples/<日付>/`、版ごとの変更説明が `changelog/`、運用と SEP が `docs/`、という **「版スナップショット + 並行ドラフト（unreleased）」** 構造である。これは、HTTP IF・JSON データモデル・説明 RFC・ガバナンスを同じリポジトリで型付きに同期させるための典型的な配置だと解釈できる。

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

**IF 定義（HTTP）** は `spec/2026-01-30/openapi/` に集約される。

| 表面 | 主な操作 | 役割 |
|------|-----------|------|
| `openapi.agentic_checkout.yaml` | `POST /checkout_sessions`（作成）、`POST|GET /checkout_sessions/{id}`（更新・取得）、`POST .../complete`（完了）、`POST .../cancel`（取消） | エージェント起点のチェックアウト・セッションライフサイクル |
| `openapi.delegate_payment.yaml` | `POST /agentic_commerce/delegate_payment` | 許容額（Allowance）付きで PSP が資格情報をトークン化し、マーチャントが制限利用できるようにする |
| `openapi.agentic_checkout_webhook.yaml` | （別ファイル） | マーチャント側の Webhook 契約（イベント通知側の IF） |

**データモデル** は同名版の `json-schema/` に `schema.agentic_checkout.json`（セッション・注文等の中心）、`schema.delegate_payment.json`、`schema.discount.json`、`schema.extension.json` として分かれている。チェックアウトは `CheckoutSession` を権威ある状態として返し、完了時に `CheckoutSessionWithOrder` で注文を束ねる形が OpenAPI 上の構造と整合する。

### 認証認可

`openapi.agentic_checkout.yaml` では **グローバル `security: [bearerAuth: []]`** とし、`components.securitySchemes.bearerAuth` で **HTTP Bearer（bearerFormat: API Key）** を定義している。リクエストごとに `Authorization` ヘッダ（必須、`Bearer api_key_123` 例）と **必須の `API-Version`（YYYY-MM-DD）**、任意の `Idempotency-Key` / `Request-Id` / `Signature` / `Timestamp` などがパラメータとして繰り返し参照される。

`Signature` / `Timestamp` の説明は **「Webhook 検証向け」** のニュアンスで記載されているが、チェックアウトの各オペレーションの parameters にも含まれる。**エンドユーザの OAuth フローそのものを OpenAPI が包括的に定義するのではなく、マーチャント API へのサーバ間アクセス制御と相関・リプレイ対策のフックを提供する** という分解になっている。

買い手側の状態として、`Buyer` スキーマには `authentication_status`（`authenticated` / `guest` / `requires_signin`）が存在し、セッションは `authentication_required` 等のステータスを取り得る。決済介入（例: 3DS）向けに `authentication_metadata` や 3DS 結果オブジェクトが定義されており、**「ログイン」ではなく主に決済系の強認証介入** と読める。

### サポートする決済手段

`changelog/2026-01-30.md` では **Payment Handlers フレームワーク** が導入され、`capabilities.payment.handlers` で **名前・version・spec URL・PSP・delegate / PCI 要件・instrument schema** などを構造化する方針が示されている。サンプルとしてカード（ブランド交渉、3DS 等）が中心に登場する。

一方、`openapi.delegate_payment.yaml` の説明では **「現在サポートする資格情報タイプは card のみ」** と明示されている。つまり **プロトコル全体としてはハンドラによる拡張余地を規定しつつ、Delegate Payment のコア記述はカード前提** であり、他手段はハンドラ/実装側の追従が必要な領域として残る。

### 状態管理・セッション管理

`CheckoutSession` / `CheckoutSessionBase` の `status` は、少なくとも次の列挙でライフサイクルが表現される: `incomplete`, `not_ready_for_payment`, `requires_escalation`, `authentication_required`, `ready_for_payment`, `pending_approval`, `complete_in_progress`, `completed`, `canceled`, `in_progress`, `expired`。作成・更新・完了・取消の各エンドポイントと、表示用 `messages[]`、介入用 `capabilities`、期限 `expires_at` が組み合わさり、**サーバ権威のセッション状態機械**として設計されている。

OpenAPI は遷移表を 1 枚の表で固定していないため、下図は **列挙値とエンドポイントの意味から整理した概念上の状態遷移**である。実装ごとに到達し得る辺が異なり、失敗経路や `expired` の扱いもセラー実装に依存する。

```mermaid
stateDiagram-v2
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

## 未解決事項・不足情報

- **GitHub Releases / タグが空** のため、「最新リリース」を Git の tag として機械的に指すことはできない。運用上の「latest stable」は README と `spec/2026-01-30` の位置づけに依存する。
- 本調査は **リポジトリの公開テキストと Issue 一覧** に基づく。**Discussion の要約やメンテナ毎の公式優先度付けは未実施**（open 一覧の機械的分類は `open-issues-filtered.md` を参照）。
- `Signature` / `Timestamp` をチェックアウト操作にまで要求するかは、実装プロファイル次第であり、OpenAPI 上は `required: false` と **parameters での参照** にとどまる部分がある。**マーチャント向け必須ポリシーは別文書（实施ガイド）要確認**。

## 次のアクション

- 実装を追う場合は **OpenAI / Stripe の実装ドキュメント**（公式 README 記載のリンク）と、`spec/2026-01-30` を突き合わせる。
- 決済手段のロードマップは **`rfcs/rfc.payment_handlers.md` と Delegate Payment OpenAPI の差分**、および Payment 関連 open Issue を定期追跡する。
- 次版取り込み予定のテーマは **`changelog/unreleased/` と `spec/unreleased/`** をウォッチする。
- **実施済み（2026-04-05）**: open Issue/PR の一覧と **暫定優先度（P1–P3）** を `insights/002-acp-research/open-issues-filtered.md` に記録した。当該リポジトリでは **SEP 用の GitHub ラベルは付与されておらず**、API 上も open 93 件では `labels` が空だったため、**タイトル（`SEP:` / `[SEP]` 等）とキーワード**で近似分類している。環境に `gh` がある場合のラベルフィルタ例も同メモに併記した。

## 参照ファイル

- `insights/002-acp-research/README.md`
- `insights/002-acp-research/open-issues-filtered.md`（open Issue/PR 一覧・暫定優先度・`gh` 例）
- （Target）`https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/README.md`
- （Target）`spec/2026-01-30/openapi/openapi.agentic_checkout.yaml`
- （Target）`spec/2026-01-30/openapi/openapi.delegate_payment.yaml`
- （Target）`changelog/2026-01-30.md`

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
