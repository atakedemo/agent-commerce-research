# 状態遷移図（GCPデプロイ版）

本書は `demos/01-sample-ucp_ap2/zz-docs/state-transition.md` をGCPデプロイ構成に対応させたものである。
ビジネスロジックの状態遷移はローカル開発版と同一だが、GCP版では各状態変化が **Cloud SQL（PostgreSQL）** に永続化される点が異なる。

---

## 1. ストアフロント上の主要ユースケース（カート〜注文確認）

GCP版ではストアフロント（`ec-storefront` Cloud Run）からバックエンド（`ec-backend` Cloud Run）への通信がCloud Run内部URLを介する。状態はすべてCloud SQL上のMedusaデータとして永続化される。

```mermaid
stateDiagram-v2
  [*] --> 訪問
  訪問 --> リージョン確定: URL国コード/Geo/既存クッキー
  リージョン確定 --> 商品閲覧: 同セッション内
  商品閲覧 --> カート未作成: 初回加算
  商品閲覧 --> カート既存: 再訪(カートIDクッキー)
  カート未作成 --> カート未作成: 行追加/数量変更
  カート未作成 --> カート下書き: 空でない/配送・支払い入力中
  カート既存 --> カート下書き: 行追加/数量変更
  カート下書き --> 注文手続中: チェックアウト(配送・支払い・確定)
  注文手続中 --> 注文完了: 決済/確定成功
  注文手続中 --> カート下書き: 戻る/再編集(実装に依存)
  注文完了 --> 注文確認表示: 確認ページ/メール
  注文確認表示 --> [*]
  カート下書き --> [*]: セッション断/abandon(概念)
```

---

## 2. 注文・決済の代表的遷移（Medusa コア概念）

`ec-backend`（Cloud Run）上の Medusa v2 が管理する `Order` の **status**・**payment_status**・**fulfillment_status** の遷移。
すべての状態変化は Cloud SQL（PostgreSQL 15）に永続化される。

```mermaid
stateDiagram-v2
  state "注文 (Order.status)" as O {
    [*] --> pending
    pending --> requires_action: 3DS/追加認証(例)
    requires_action --> completed: 承認/捕捉完了
    pending --> completed: 即時成立
    pending --> canceled: 期限切れ/取消
    completed --> canceled: 運用(取消ポリシーに依存)
    canceled --> [*]
    completed --> [*]
  }

  state "支払い (payment_status 概念)" as P {
    [*] --> not_paid
    not_paid --> authorized
    not_paid --> pending
    pending --> paid
    authorized --> paid
    authorized --> not_paid: 失効/却下(例)
    paid --> partially_refunded: 部分返金(例)
    paid --> refunded: 全額返金(例)
    partially_refunded --> refunded
  }

  state "履行 (fulfillment_status 概念)" as F {
    [*] --> not_fulfilled
    not_fulfilled --> partially_fulfilled
    partially_fulfilled --> shipped
    not_fulfilled --> shipped: 一括
    shipped --> returned: 返品(例)
  }
```

---

## 3. Checkout セッション状態遷移（UCP / MCP フロー）

`mcp-server`（Cloud Run）が管理するチェックアウトセッション（`b-mcp-server` の in-memory store）の状態遷移。

> GCP版では Cloud Run インスタンスの再起動によりメモリ状態が消失する点に注意。
> 本番化する場合は Memorystore（Redis）への状態永続化を検討する。

```mermaid
stateDiagram-v2
  [*] --> incomplete: create_checkout 呼び出し

  incomplete --> ready_for_complete: update_checkout<br/>（配送先・メール確定）
  incomplete --> incomplete: update_checkout<br/>（部分更新）
  incomplete --> canceled: cancel_checkout

  ready_for_complete --> completed: complete_checkout<br/>（決済トークン・detokenize・Stripe confirm 成功）
  ready_for_complete --> incomplete: update_checkout<br/>（再編集）
  ready_for_complete --> canceled: cancel_checkout

  completed --> [*]
  canceled --> [*]
```

---

## 4. UCP 決済トークン状態遷移（payment-handler）

`payment-handler`（Cloud Run）上の `tokenStore`（in-memory）が管理する UCP トークンの状態遷移。

> GCP版では Cloud Run インスタンスの再起動によりトークンが消失する点に注意。
> TTL（デフォルト30分）内に `complete_checkout` → `/detokenize` を完了する必要がある。

```mermaid
stateDiagram-v2
  [*] --> valid: POST /tokenize<br/>（Stripe PaymentIntent 作成）

  valid --> consumed: POST /detokenize<br/>（MCP complete_checkout 内部処理）
  valid --> expired: TTL（30分）経過

  consumed --> [*]
  expired --> [*]
```

---

## 5. AP2 Mandate 状態遷移（Trusted Surface + Credential Provider）

AP2 HNP フローにおける Mandate の状態遷移。`trusted-surface`（Cloud Run）と `payment-handler`（Cloud Run）が連携して管理する。

```mermaid
stateDiagram-v2
  state "Open Mandate（trusted-surface）" as OM {
    [*] --> open_issued: POST /open-mandate<br/>（ユーザー同意 + TS 署名）
    open_issued --> open_valid: TTL 内
    open_valid --> open_expired: TTL（デフォルト: 1時間）経過
    open_valid --> open_consumed: Closed Mandate に紐づいて使用済み
    open_expired --> [*]
    open_consumed --> [*]
  }

  state "Closed Mandate（エージェント署名）" as CM {
    [*] --> closed_created: Agent が agent_sk で署名<br/>（checkout_hash をバインド）
    closed_created --> closed_verified: POST /credential で検証成功
    closed_created --> closed_rejected: 検証失敗<br/>（署名不正・制約違反等）
    closed_verified --> [*]
    closed_rejected --> [*]
  }

  state "AP2 Credential Token（payment-handler）" as CT {
    [*] --> credential_issued: POST /credential<br/>（Mandate 検証成功後）
    credential_issued --> credential_consumed: POST /detokenize<br/>（checkout_hash 一致確認・単回使用）
    credential_issued --> credential_expired: TTL 経過
    credential_consumed --> [*]
    credential_expired --> [*]
  }
```

---

## 6. Cloud Run インスタンス状態（インフラ観点）

GCPデプロイ特有のインフラ状態遷移。Cloud Run のオートスケーリングと最小インスタンス設定に基づく。

```mermaid
stateDiagram-v2
  state "Cloud Run インスタンス" as CR {
    [*] --> cold_start: リクエスト到着 or スケールアウト
    cold_start --> warm: 初期化完了（環境変数・Secret Manager 読み込み）
    warm --> warm: リクエスト処理中
    warm --> idle: リクエスト完了（最小インスタンス=0 のサービス）
    idle --> [*]: アイドルタイムアウト（最小インスタンス=0）
    warm --> [*]: スケールイン（最小インスタンス=1 は維持）
  }
```

**最小インスタンス設定（`design.md` §3.1 参照）:**

| サービス | 最小インスタンス | コールドスタート影響 |
|---|---|---|
| `ec-backend` | 1 | なし（常時ウォーム） |
| `ec-storefront` | 1 | なし |
| `ai-agent-app` | 1 | なし |
| `mcp-server` | 0 | あり（初回リクエストで約2〜5秒の遅延） |
| `payment-handler` | 0 | あり |
| `trusted-surface` | 0 | あり |

> `mcp-server`・`payment-handler`・`trusted-surface` は最小インスタンス=0 のため、非アクティブ時は停止。
> デモ用途では許容可。本番化・低レイテンシ要件がある場合は最小インスタンスを1以上に変更する。

---

## 補足

- **メモリ状態の揮発性**: `mcp-server`・`payment-handler` の in-memory store（チェックアウトセッション・トークンストア）は Cloud Run インスタンスの再起動・スケールインで消失する。本番化の際は Memorystore（Redis）への移行を推奨する。
- **状態の永続化**: `Order`・`Cart`・`PaymentCollection` 等のビジネスエンティティは Cloud SQL（PostgreSQL）に永続化されるため、インスタンス再起動の影響を受けない。
- **Medusa Admin からの手動操作**（ドラフト注文・部分フルフィルメント等）は上記以外の遷移を生む。本図はストアフロント中心の既定フローの俯瞰用である。
