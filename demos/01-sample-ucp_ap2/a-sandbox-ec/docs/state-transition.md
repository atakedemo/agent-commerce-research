# 状態遷移図

本ドキュメントの状態遷移は、**a-sandbox-ec**（Medusa v2 バックエンド + Next.js ストアフロント）における、利用者の主要シナリオと、バックエンド上の**注文・決済**の代表状態を Mermaid で表したものである。DB の実際の列挙子は Medusa バージョンで微差があり得るため、**概念的な遷移**として読む。

## 1. ストアフロント上の主要ユースケース（カート〜注文確認）

訪問からカート保持、注文確定、確認表示までの流れを、アプリケーション上の**ユースケース段階**として示す。実装の詳細（API の内部状態名）は図2・Medusa ドキュメントと対応づけられる。

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

## 2. 注文・決済の代表的遷移（Medusa コア概念）

本サンドボックスの永続化は Medusa である。`Order` の **status**、**payment_status**、**fulfillment_status** はワークフロー（支払い取得・出荷等）に応じて遷移する。以下は**代表例**であり、全パターン（返品・要対応等）は公式ドメインモデルを参照のこと。

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

図1の「**注文完了**」に相当するタイミングで、図2の `Order`・支払い・履行の各軸が整合する（具体的な遷移順は決済・配送プロバイダ設定に依存する）。

## 補足

- カート（`Cart`）と注文（`Order`）の関係: 注文確定時にカート内容が**注文行**に写し替えられ、以降は `Order` を主とする。カートの寿命とクッキー管理は `apps/storefront/src/lib/data/cart.ts` およびクッキー系モジュールで行う。
- Admin 上での手動作業（ドラフト注文、一部フルフィルメント等）は、上記以外の遷移を生む。本図は**ストアフロント中心の既定フロー**の俯瞰用である。
