# 状態遷移図

## Mandate ライフサイクル（全体）

```mermaid
stateDiagram-v2
    [*] --> Open : ユーザ承認・生成\n（user_sk で署名）

    Open --> Evaluating : マーチャント / CP が\n制約評価を実施

    Evaluating --> Closed : 制約充足\n→ agent_sk で署名
    Evaluating --> UnresolvedConstraint : 制約未充足\n（価格超過・商品不一致など）

    UnresolvedConstraint --> [*] : ユーザ再介入が必要

    Closed --> Submitted : Shopping Agent が\n検証者に提示

    Submitted --> Success : 各検証者が承認\n→ Receipt 発行
    Submitted --> Rejected : 検証失敗\n（署名不正・重複・期限切れ）

    Success --> [*]
    Rejected --> [*]
```

---

## Checkout Mandate 状態遷移

```mermaid
stateDiagram-v2
    [*] --> OpenCheckoutMandate : Shopping Agent が生成\nvct = mandate.checkout.open.1\n制約: allowed_merchants, line_items

    OpenCheckoutMandate --> ClosedCheckoutMandate : Merchant が Checkout JWT を発行\n→ checkout_jwt_hash でバインド\nvct = mandate.checkout.1

    ClosedCheckoutMandate --> CheckoutReceipt : Merchant が検証・注文完了\niss = Merchant\nresult = "success" | "error"

    CheckoutReceipt --> [*]
```

### Checkout Mandate のフィールド変化

| 状態 | `vct` | 追加されるフィールド |
| --- | --- | --- |
| Open | `mandate.checkout.open.1` | constraints（allowed_merchants, line_items） |
| Closed | `mandate.checkout.1` | checkout_hash, checkout_jwt |
| Receipt | — | order_id, status, iss（Merchant） |

---

## Payment Mandate 状態遷移

```mermaid
stateDiagram-v2
    [*] --> OpenPaymentMandate : Shopping Agent が生成\nvct = mandate.payment.open.1\n制約: 金額・頻度・許可 PSP など

    OpenPaymentMandate --> ClosedPaymentMandate : checkout_jwt_hash でバインド\nエージェントが制約を評価\nvct = mandate.payment.1

    ClosedPaymentMandate --> PaymentToken : CP が SD-JWT チェーン検証\n→ スコープ付き単回用途トークン発行

    PaymentToken --> PaymentReceipt : MPP が決済処理\niss = MPP\nresult = "success" | "error"

    PaymentReceipt --> [*]
```

### Payment Mandate のフィールド変化

| 状態 | `vct` | 追加されるフィールド |
| --- | --- | --- |
| Open | `mandate.payment.open.1` | constraints（amount_range, budget, recurrence など） |
| Closed | `mandate.payment.1` | transaction_id, payee, payment_amount, payment_instrument, checkout_jwt_hash |
| Receipt | — | mandate_ref, status, iss（MPP） |

---

## Mandate チェーンの連結

```mermaid
stateDiagram-v2
    OpenCheckoutMandate --> ClosedCheckoutMandate : checkout_jwt_hash でバインド
    ClosedCheckoutMandate --> ClosedPaymentMandate : checkout_jwt_hash を参照\n（Payment Mandate の reference 制約）
    ClosedPaymentMandate --> PaymentToken : CP が two-mandate chain を検証
```

> `checkout_jwt_hash` を用いた暗号ハッシュバインディングにより、CheckoutMandate と PaymentMandate が単一トランザクションに恒久的に紐付けられる。

---

## ダブルスペンド防止ルール

- Shopping Agent は、レシートを受け取るまで同一スコープで新規 Open Mandate を作成してはならない。
- Closed Mandate の提示後、Action Receipt 受領前に重複 Mandate を送信した場合、検証者はこれを拒否する。
