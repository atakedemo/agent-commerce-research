# API 一覧

> AP2 v0.2 における「API」は、REST エンドポイントではなく **MCP ツール呼び出し**（MCP 実装）および **A2A メッセージング**（Agent 実装）として提供されます。各実装の対応プロトコルは下表を参照してください。

---

## ロール別実装とプロトコル対応


| ロール                              | 実装ディレクトリ                                                          | プロトコル                      |
| -------------------------------- | ----------------------------------------------------------------- | -------------------------- |
| Shopping Agent                   | `code/samples/python/src/roles/shopping_agent/`                   | ADK（Agent Development Kit） |
| Shopping Agent v2                | `code/samples/python/src/roles/shopping_agent_v2/`                | ADK v2                     |
| Merchant Agent                   | `code/samples/python/src/roles/merchant_agent/`                   | A2A                        |
| Merchant Agent (MCP)             | `code/samples/python/src/roles/merchant_agent_mcp/`               | MCP（FastMCP + stdio）       |
| Credential Provider              | `code/samples/python/src/roles/credentials_provider_agent/`       | A2A                        |
| Credential Provider (MCP)        | `code/samples/python/src/roles/credentials_provider_mcp/`         | MCP（FastMCP + stdio）       |
| Merchant Payment Processor       | `code/samples/python/src/roles/merchant_payment_processor_agent/` | A2A                        |
| Merchant Payment Processor (MCP) | `code/samples/python/src/roles/merchant_payment_processor_mcp/`   | MCP（FastMCP + stdio）       |
| x402 Credential Provider (MCP)   | `code/samples/python/src/roles/x402_credentials_provider_mcp/`    | MCP（FastMCP + stdio）       |
| x402 PSP (MCP)                   | `code/samples/python/src/roles/x402_psp_mcp/`                     | MCP（FastMCP + stdio）       |


---

## Merchant Agent が提供する API

Shopping Agent がカタログ・チェックアウトを操作するためのインターフェイス。


| ツール名                | 呼び出し元          | 引数                                                                    | 戻り値                                                  | 概要                          |
| ------------------- | -------------- | --------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------- |
| `search_inventory`  | Shopping Agent | `product_description: str` `constraint_price_cap: float?`             | item_id, name, price, stock                          | 商品説明で在庫を検索。価格上限制約を適用        |
| `check_product`     | Shopping Agent | `item_id: str` `constraint_price_cap: float?`                         | item_id, price, available, timestamp, payment_method | アイテムの現在価格・在庫状況を確認           |
| `assemble_cart`     | Shopping Agent | `item_id: str` `qty: int`                                             | cart_id, line_items, total, currency                 | 指定アイテム・数量でカートを作成            |
| `create_checkout`   | Shopping Agent | `cart_id: str` `open_checkout_mandate_id: str`                        | checkout_jwt, checkout_jwt_hash, open_checkout_hash  | ES256 署名付き Checkout JWT を発行 |
| `complete_checkout` | Shopping Agent | `payment_token: str` `checkout_mandate_id: str` `checkout_nonce: str` | status, order_id, checkout_receipt                   | Mandate SD チェーン検証・決済処理・注文確定 |


---

## Credential Provider が提供する API

Shopping Agent が決済トークンを取得・管理するためのインターフェイス。


| ツール名                        | 呼び出し元               | 引数                                                                                                      | 戻り値                       | 概要                                 |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------- |
| `issue_payment_credential`  | Shopping Agent      | `payment_mandate_chain_id: str` `open_checkout_hash: str` `checkout_jwt_hash: str` `payment_nonce: str` | payment_token, expires_at | SD-JWT 委任チェーン検証後、スコープ付き単回用途トークンを発行 |
| `revoke_payment_credential` | Shopping Agent      | `payment_token: str`                                                                                    | status                    | 発行済みトークンを失効                        |
| `verify_payment_receipt`    | Shopping Agent / CP | `payment_receipt: str`                                                                                  | status, verified          | MPP からの決済レシートを検証                   |


---

## Merchant Payment Processor が提供する API

Merchant Agent が決済処理を委譲するためのインターフェイス。


| ツール名               | 呼び出し元          | 引数                                                                      | 戻り値                     | 概要                                               |
| ------------------ | -------------- | ----------------------------------------------------------------------- | ----------------------- | ------------------------------------------------ |
| `initiate_payment` | Merchant Agent | `payment_token: str` `checkout_jwt_hash: str` `open_checkout_hash: str` | status, payment_receipt | HNP フロー向け決済開始。Payment Mandate を検証し、CP に決済レシートを送信 |


---

## x402（暗号資産）対応 API

### x402 Credential Provider が提供する API


| ツール名                        | 呼び出し元          | 引数                                                                                                      | 戻り値                                      | 概要                                         |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------ |
| `issue_payment_credential`  | Shopping Agent | `payment_mandate_chain_id: str` `open_checkout_hash: str` `checkout_jwt_hash: str` `payment_nonce: str` | payment_token, expires_at, bundled_token | 委任チェーン検証後、EIP-3009 署名（USDC）を生成しバンドルトークンを返却 |
| `revoke_payment_credential` | Shopping Agent | `payment_token: str`                                                                                    | status                                   | 発行済み x402 トークンを失効                          |
| `list_x402_wallets`         | Shopping Agent | —                                                                                                       | wallets[](address, balance, network)     | ユーザの x402 ウォレット情報を返却                       |


---

## AP2 SDK API

Python SDK（`code/sdk/python/ap2/`）が提供する主要モジュール。


| モジュール     | パス                                   | 概要                                              |
| --------- | ------------------------------------ | ----------------------------------------------- |
| models    | `code/sdk/python/ap2/models/`        | Pydantic データモデル（Mandate, Receipt, Constraint 等） |
| schemas   | `code/sdk/python/ap2/schemas/`       | JSON Schema 定義                                  |
| sdk       | `code/sdk/python/ap2/sdk/`           | Mandate 検証・署名ユーティリティ（`mandate.py` 等）            |
| generated | `code/sdk/python/ap2/sdk/generated/` | 自動生成コード                                         |
| tests     | `code/sdk/python/ap2/tests/`         | テストスイート                                         |


詳細は `code/sdk/python/ap2/sdk/README.md`（SDK API リファレンス）を参照。

---

## 署名アルゴリズム


| 用途                                      | アルゴリズム                     |
| --------------------------------------- | -------------------------- |
| Checkout JWT（Merchant 署名）               | ES256（ECDSA P-256）         |
| Open/Closed Mandate（user_sk / agent_sk） | ES256（ECDSA P-256）         |
| x402 決済（EIP-3009）                       | EIP-712 / ECDSA（secp256k1） |


