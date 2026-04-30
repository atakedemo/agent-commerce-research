# シーケンス図

## Human Present フロー

ユーザが各ステップで承認に直接関与する標準購買フロー。

```mermaid
sequenceDiagram
    actor User
    participant SA as Shopping Agent
    participant TS as Trusted Surface
    participant MA as Merchant Agent (MCP)
    participant CP as Credential Provider (MCP)
    participant MPP as Merchant Payment Processor (MCP)

    User->>SA: ショッピングタスク開始
    SA->>SA: Open Checkout Mandate + Open Payment Mandate 生成

    Note over SA,MA: Phase 1 — ショッピング
    SA->>MA: search_inventory(product_description, open_checkout_mandate_id)
    MA->>SA: 商品リスト
    SA->>MA: assemble_cart(item_id, qty)
    MA->>SA: cart_id, line_items, total
    SA->>MA: create_checkout(cart_id, open_checkout_mandate_id)
    MA->>SA: checkout_jwt, checkout_jwt_hash
    SA->>CP: 利用可能決済手段の問い合わせ（Open Payment Mandate 提示）
    CP->>SA: 決済手段リスト

    Note over SA,TS: Phase 2 — 承認・署名
    SA->>TS: Closed Checkout Mandate + Closed Payment Mandate をユーザ承認依頼
    TS->>User: マンデート内容を表示・認証要求
    User->>TS: 生体認証 / PIN で承認
    TS->>SA: user_sk で署名した Closed Mandates

    Note over SA,MPP: Phase 2 — 決済実行
    SA->>CP: issue_payment_credential(payment_mandate_chain_id, open_checkout_hash, checkout_jwt_hash, nonce)
    CP->>SA: payment_token
    SA->>MA: complete_checkout(payment_token, checkout_mandate_id, checkout_nonce)
    MA->>MPP: initiate_payment(payment_token, checkout_jwt_hash, open_checkout_hash)
    MPP->>MA: payment_receipt
    MA->>SA: order_id, checkout_receipt
    SA->>User: 購入完了通知
```

---

## Human Not Present フロー

ユーザが事前に制約付き Open Mandate を承認し、エージェントが自律的に購買・決済を完了するフロー。

```mermaid
sequenceDiagram
    actor User
    participant SA as Shopping Agent
    participant TS as Trusted Surface
    participant MA as Merchant Agent (MCP)
    participant CP as Credential Provider (MCP)
    participant MPP as Merchant Payment Processor (MCP)

    Note over User,TS: Phase 1a — 事前承認（Human Present）
    User->>SA: 自律購買タスクと制約を指定
    SA->>TS: Open Checkout Mandate + Open Payment Mandate（制約付き）承認依頼
    TS->>User: 制約内容を表示・認証要求
    User->>TS: 生体認証 / PIN で承認
    TS->>SA: user_sk で署名した Open Mandates（制約付き）

    Note over SA,MA: Phase 1b — 自律ショッピング（Human Not Present）
    SA->>MA: search_inventory(product_description, constraint_price_cap)
    MA->>SA: 商品リスト（価格制約内）
    SA->>MA: check_product(item_id, constraint_price_cap)
    MA->>SA: price, available, timestamp
    SA->>MA: assemble_cart(item_id, qty)
    MA->>SA: cart_id, line_items, total
    SA->>MA: create_checkout(cart_id, open_checkout_mandate_id)
    MA->>SA: checkout_jwt, checkout_jwt_hash
    SA->>SA: 制約評価 → agent_sk で Closed Mandates に署名

    Note over SA,MPP: Phase 2 — 自律決済（Human Not Present）
    SA->>CP: issue_payment_credential(closed mandate chain, checkout_jwt_hash, nonce)
    CP->>SA: payment_token
    SA->>MA: complete_checkout(payment_token, checkout_mandate_id, nonce)
    MA->>MPP: initiate_payment(payment_token, checkout_jwt_hash, open_checkout_hash)
    MPP->>MA: payment_receipt
    MA->>SA: order_id, checkout_receipt
    Note over SA: ダブルスペンド防止: レシート受領まで新規 Mandate 作成禁止
```

---

## 登場ロールの凡例

| ロール | 略称 | 説明 |
| --- | --- | --- |
| Shopping Agent | SA | 商品探索・チェックアウト・購買実行を担当する LLM エージェント |
| Trusted Surface | TS | ユーザ同意を取得する非エージェント UI（非決定的コード禁止） |
| Merchant Agent | MA | カタログ提供・Checkout JWT 署名・注文確定を担当 |
| Credential Provider | CP | 決済手段管理・トークン発行・SD-JWT 検証を担当 |
| Merchant Payment Processor | MPP | 最終的な決済処理・レシート発行を担当 |
