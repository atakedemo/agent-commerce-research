# シーケンス図

> **公式参照画像（AP2リポジトリ `docs/assets/`）**
>
> | フロー | 全体図 | ショッピングフェーズ | 決済フェーズ |
> |---|---|---|---|
> | Human Present | [ap2_hp_flow.svg](https://raw.githubusercontent.com/google-agentic-commerce/AP2/main/docs/assets/ap2_hp_flow.svg) | [ap2_hp_shopping.svg](https://raw.githubusercontent.com/google-agentic-commerce/AP2/main/docs/assets/ap2_hp_shopping.svg) | [ap2_hp_payment.svg](https://raw.githubusercontent.com/google-agentic-commerce/AP2/main/docs/assets/ap2_hp_payment.svg) |
> | Human Not Present | [ap2_hnp_flow.svg](https://raw.githubusercontent.com/google-agentic-commerce/AP2/main/docs/assets/ap2_hnp_flow.svg) | [ap2_hnp_shopping.svg](https://raw.githubusercontent.com/google-agentic-commerce/AP2/main/docs/assets/ap2_hnp_shopping.svg) | [ap2_hnp_payment.svg](https://raw.githubusercontent.com/google-agentic-commerce/AP2/main/docs/assets/ap2_hnp_payment.svg) |
>
> **公式画像との整合性**: 本 Mermaid 図は `docs/ap2/flows.md` の記述と照合済み。全体的に一致。HNP の Phase 1a（HP 期）と Phase 1b（HNP 期）を公式は分割表示するが、本図では `Note` + `rect` で区切る形で統合している。

## Human Present フロー

ユーザが各ステップで承認に直接関与する標準購買フロー。

```mermaid
sequenceDiagram
    actor User
    participant TS as Trusted Surface
    participant SA as Shopping Agent
    participant CP as Credential Provider
    participant MA as Merchant
    participant MPP as Merchant Payment Processor
    participant NW as Network

    rect rgb(173, 216, 230)
        Note over User,MPP: Shopping Journey
        User->>SA: Shopping context conversation
        SA->>MA: search_inventory<br>(product_description)
        MA-->>SA: Catalog data
        SA->>MA: assemble_cart<br>(item_id, qty)
        MA-->>SA: cart_id, line_items, total
        SA->>MA: create_checkout<br>(cart_id, open_checkout_mandate_id)
        MA-->>SA: Merchant Signed Checkout<br>(checkout_jwt, checkout_jwt_hash)
        SA->>CP: retrieve payment options
        CP-->>SA: payment options
        SA->>SA: select payment option
    end

    rect rgb(144, 238, 144)
        Note over User,NW: Payment Journey
        SA->>TS: Capture User consent for Checkout placement and Payment
        TS->>User: Please confirm purchase<br>(CheckoutMandateContents, PaymentMandateContents)
        User->>TS: Confirmed
        TS->>TS: Sign Mandates w/user_sk
        TS-->>SA: Signed Mandates
        SA->>+CP: issue_payment_credential<br>(mandate_chain_id, open_checkout_hash, checkout_jwt_hash, nonce)
        CP->>CP: Verify Payment Mandate
        CP->>NW: Payment Mandate
        NW->>NW: Verify Payment Mandate
        NW-->>CP: payment_token
        CP->>-SA: payment_token
        SA->>MA: complete_checkout<br>(payment_token, checkout_mandate_id, checkout_nonce)
        MA->>MA: Validate Checkout Mandate
        MA->>MPP: initiate_payment<br>(payment_token, checkout_jwt_hash, open_checkout_hash)
        MPP->>MPP: verify Payment Mandate
        MPP-->>CP: Signed Payment Receipt [CP: verify_payment_receipt()]
        CP-->>NW: Signed Payment Receipt
        MA-->>SA: Signed Checkout Receipt<br>(order_id, checkout_receipt)
    end
```

---

## Human Not Present フロー

ユーザが事前に制約付き Open Mandate を承認し、エージェントが自律的に購買・決済を完了するフロー。

```mermaid
sequenceDiagram
    actor User
    participant TS as Trusted Surface
    participant SA as Shopping Agent
    participant CP as Credential Provider
    participant MA as Merchant
    participant MPP as Merchant Payment Processor
    participant NW as Network

    rect rgb(173, 216, 230)
        Note over User,MPP: Shopping Journey
        User->>SA: Shopping context conversation
        Note over SA,TS: Create Open Mandate
        SA->>TS: Request Mandate Approval<br>(Contents, sa_pk)
        TS->>User: Confirmation of Open Mandate Contents
        User->>TS: Approved
        TS->>TS: Sign Mandates w/user_sk
        TS-->>SA: Mandates, user_credential
        SA->>SA: Store Mandates, user_credential
        Note over SA,TS: Completed Open Mandate
        Note over User,MPP: User Leaves Session
        SA->>MA: search_inventory<br>(product_description, constraint_price_cap)
        MA-->>SA: Catalog data
        SA->>MA: assemble_cart<br>(item_id, qty)
        MA-->>SA: cart_id, line_items, total
        SA->>MA: create_checkout<br>(cart_id, open_checkout_mandate_id)
        MA-->>SA: Merchant Signed Checkout<br>(checkout_jwt, checkout_jwt_hash)
    end

    rect rgb(144, 238, 144)
        Note over User,MPP: Payment Journey
        SA->>SA: Selects appropriate Open Mandates
        SA->>SA: Sign Closed Checkout and Payment Mandate w/ agent_sk
        SA->>+CP: issue_payment_credential<br>(closed_mandate_chain_id, open_checkout_hash, checkout_jwt_hash, nonce)
        CP->>CP: Verify Payment Mandates and Constraints
        CP->>NW: payment token request(Payment Mandate)
        NW->>NW: Verify Payment Mandate and Constraints
        NW-->>CP: payment_token
        CP-->>-SA: payment_token
        SA->>MA: complete_checkout<br>(payment_token, checkout_mandate_id, checkout_nonce)
        MA->>MPP: initiate_payment<br>(payment_token, checkout_jwt_hash, open_checkout_hash)
        MPP->>MPP: verify Payment Mandates
        MPP-->>CP: Signed Payment Receipt [CP: verify_payment_receipt()]
        MA-->>SA: Signed Checkout Receipt<br>(order_id, checkout_receipt)
    end
```

---

## 登場ロールの凡例

| ロール | 略称 | 説明 |
| --- | --- | --- |
| Shopping Agent | SA | 商品探索・チェックアウト・購買実行を担当する LLM エージェント |
| Trusted Surface | TS | ユーザ同意を取得する非エージェント UI（非決定的コード禁止） |
| Merchant | MA | カタログ提供・Checkout JWT 署名・注文確定を担当 |
| Credential Provider | CP | 決済手段管理・トークン発行・マンデート検証を担当 |
| Network | NW | 決済クレデンシャルの検証・payment_token 発行を担当 |
| Merchant Payment Processor | MPP | 最終的な決済処理・レシート発行を担当 |

## MCP ツール補記の凡例

| ツール名 | MCP サーバ | 補記箇所 |
| --- | --- | --- |
| `search_inventory` | merchant_agent_mcp | Return Catalogue（商品検索） |
| `assemble_cart` | merchant_agent_mcp | Add items to cart |
| `create_checkout` | merchant_agent_mcp | Create Checkout（Checkout JWT 発行） |
| `complete_checkout` | merchant_agent_mcp | Checkout 完了・注文確定 |
| `issue_payment_credential` | credentials_provider_mcp | Payment Mandate → payment_token 発行 |
| `verify_payment_receipt` | credentials_provider_mcp | MPP からのレシート受領時に CP 側で実行 |
| `initiate_payment` | merchant_payment_processor_mcp | Merchant → MPP 決済開始 |
| retrieve payment options | — | サンプル実装に対応 MCP ツールなし |
