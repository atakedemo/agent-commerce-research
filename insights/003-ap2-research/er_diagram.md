# ER 図

## コアデータモデル

```mermaid
erDiagram
    OpenCheckoutMandate {
        string mandate_id PK
        string vct "mandate.checkout.open.1"
        string iss "発行者（SA）"
        string cnf "key binding (agent_pk)"
        json constraints "CheckoutConstraints[]"
    }

    ClosedCheckoutMandate {
        string mandate_id PK
        string vct "mandate.checkout.1"
        string checkout_hash "Base64url(SHA-256(checkout_jwt))"
        string checkout_jwt FK
    }

    CheckoutJWT {
        string jwt_id PK
        string merchant_id FK
        json line_items "LineItem[]"
        float total
        string currency
        string exp "短寿命"
        string signature "Merchant ES256"
    }

    LineItem {
        string item_id PK
        string title
        float price
        string currency
        int qty
    }

    CheckoutConstraints {
        string constraint_id PK
        string type "checkout.allowed_merchants | checkout.line_items"
        json value
    }

    CheckoutReceipt {
        string receipt_id PK
        string mandate_ref FK "ClosedCheckoutMandate.mandate_id"
        string order_id
        string status "success | error"
        string iss "Merchant"
        string timestamp
    }

    OpenPaymentMandate {
        string mandate_id PK
        string vct "mandate.payment.open.1"
        string iss "発行者（SA）"
        string cnf "key binding (agent_pk)"
        json constraints "PaymentConstraints[]"
    }

    ClosedPaymentMandate {
        string mandate_id PK
        string vct "mandate.payment.1"
        string transaction_id
        string checkout_jwt_hash FK "ClosedCheckoutMandate の checkout_hash"
        json payee "Merchant id, name, website"
        json payment_amount "amount, currency"
        json payment_instrument "method, token"
        string iat
        string exp
    }

    PaymentConstraints {
        string constraint_id PK
        string type "agent_recurrence | allowed_payees | amount_range | budget | reference | execution_date | ..."
        json value
    }

    PaymentToken {
        string token_id PK
        string mandate_ref FK "ClosedPaymentMandate.mandate_id"
        string scope "single-use"
        string expires_at
        string iss "CP"
    }

    PaymentReceipt {
        string receipt_id PK
        string mandate_ref FK "ClosedPaymentMandate.mandate_id"
        string transaction_id
        string status "success | error"
        string iss "MPP"
        string timestamp
    }

    Merchant {
        string merchant_id PK
        string name
        string website
    }

    OpenCheckoutMandate ||--o{ CheckoutConstraints : "has"
    OpenCheckoutMandate ||--|| ClosedCheckoutMandate : "closes into"
    ClosedCheckoutMandate ||--|| CheckoutJWT : "binds via checkout_hash"
    CheckoutJWT ||--|| Merchant : "issued by"
    CheckoutJWT ||--o{ LineItem : "contains"
    ClosedCheckoutMandate ||--o| CheckoutReceipt : "results in"

    OpenPaymentMandate ||--o{ PaymentConstraints : "has"
    OpenPaymentMandate ||--|| ClosedPaymentMandate : "closes into"
    ClosedPaymentMandate }|--|| ClosedCheckoutMandate : "references via checkout_jwt_hash"
    ClosedPaymentMandate ||--o| PaymentToken : "issues"
    ClosedPaymentMandate ||--o| PaymentReceipt : "results in"
    PaymentToken }|--|| Merchant : "used at"
```

---

## Mandate 制約一覧

### Checkout 制約

| 制約タイプ | 説明 | 検証者 |
| --- | --- | --- |
| `checkout.allowed_merchants` | 許可マーチャントを制限 | Merchant |
| `checkout.line_items` | 許容商品・数量の制限（最大流アルゴリズムで評価） | Merchant |

### Payment 制約

| 制約タイプ | 説明 | 検証者 |
| --- | --- | --- |
| `agent_recurrence` | 繰り返し頻度・発生回数の制限 | CP / MPP |
| `allowed_payees` | 許可マーチャントの制限 | CP / MPP |
| `allowed_payment_instruments` | 許可決済手段の制限 | CP |
| `allowed_pisps` | 許可 PSP の制限 | CP |
| `amount_range` | 最小・最大金額の設定 | CP / MPP |
| `budget` | 総支出上限の設定 | CP / MPP |
| `reference` | 関連 Checkout Mandate の参照 | CP |
| `execution_date` | 有効実行日時範囲の指定 | CP / MPP |

---

## SD-JWT VDC 構造

AP2 v0.2 では Mandate を **SD-JWT（Selective Disclosure JWT）** 形式で表現する。

```
mandate_sdjwt = issuer_signed_jwt + "~" + [disclosed_claim_1 + "~"] + [kb_jwt]
```

| 部品 | 役割 |
| --- | --- |
| issuer_signed_jwt | iss（SA または TS）が ES256 で署名 |
| disclosed_claim | 検証者に開示する制約クレーム |
| kb_jwt（Key Binding JWT） | agent_sk または user_sk で署名。`transaction_data` に CheckoutJWT ハッシュ等を含む |

---

## バージョニング（`vct` クレーム）

| `vct` 値 | Mandate 種別 |
| --- | --- |
| `mandate.checkout.open.1` | Open Checkout Mandate |
| `mandate.checkout.1` | Closed Checkout Mandate |
| `mandate.payment.open.1` | Open Payment Mandate |
| `mandate.payment.1` | Closed Payment Mandate |
