# MCP 一覧

AP2 v0.2 では各役割の MCP サーバ実装が `code/samples/python/src/roles/*_mcp/server.py` に提供されます。フレームワークは **FastMCP**（`@mcp.tool()` デコレータ）を使用し、トランスポートは **stdio**（標準入出力）です。

---

## 1. Merchant Agent MCP（`merchant_agent_mcp`）

Shopping Agent がマーチャントカタログ・チェックアウトを操作するためのツール群。

| ツール名 | 引数 | 戻り値 | 概要 |
| --- | --- | --- | --- |
| `search_inventory` | `product_description: str`<br>`constraint_price_cap: float?` | item_id, name, price, stock | 商品説明で在庫を検索。価格上限制約をオプションで適用 |
| `check_product` | `item_id: str`<br>`constraint_price_cap: float?` | item_id, price, available, timestamp, payment_method | アイテムの現在価格と在庫状況を返却 |
| `assemble_cart` | `item_id: str`<br>`qty: int` | cart_id, line_items, total, currency | 指定アイテム・数量でカートを作成 |
| `create_checkout` | `cart_id: str`<br>`open_checkout_mandate_id: str` | checkout_jwt, checkout_jwt_hash, open_checkout_hash | ES256 署名付き Checkout JWT を発行。Mandate はこのハッシュでバインドされる |
| `complete_checkout` | `payment_token: str`<br>`checkout_mandate_id: str`<br>`checkout_nonce: str` | status, order_id, checkout_receipt | AP2 SDK を使用して Mandate SD チェーンを検証し、決済処理・注文確定 |

---

## 2. Credential Provider MCP（`credentials_provider_mcp`）

Shopping Agent が決済認証情報を取得・管理するためのツール群。

| ツール名 | 引数 | 戻り値 | 概要 |
| --- | --- | --- | --- |
| `issue_payment_credential` | `payment_mandate_chain_id: str`<br>`open_checkout_hash: str`<br>`checkout_jwt_hash: str`<br>`payment_nonce: str` | payment_token, expires_at | SD-JWT 委任チェーンの署名・制約を検証後、スコープ付き単回用途トークンを発行・保存 |
| `revoke_payment_credential` | `payment_token: str` | status | 発行済みトークンをトークンストアから削除・失効 |
| `verify_payment_receipt` | `payment_receipt: str` | status, verified | MPP からの決済レシートの JWT 署名を検証し内容を確認 |

---

## 3. Merchant Payment Processor MCP（`merchant_payment_processor_mcp`）

Merchant Agent が決済処理を委譲するためのツール。

| ツール名 | 引数 | 戻り値 | 概要 |
| --- | --- | --- | --- |
| `initiate_payment` | `payment_token: str`<br>`checkout_jwt_hash: str`<br>`open_checkout_hash: str` | status, payment_receipt | Human Not Present フロー向け。Payment Mandate を検証し、支払いを処理・CP に決済レシートを送信 |

---

## 4. x402 Credential Provider MCP（`x402_credentials_provider_mcp`）

EIP-3009 署名ベースの x402（USDC / Web3）決済用ツール群。

| ツール名 | 引数 | 戻り値 | 概要 |
| --- | --- | --- | --- |
| `issue_payment_credential` | `payment_mandate_chain_id: str`<br>`open_checkout_hash: str`<br>`checkout_jwt_hash: str`<br>`payment_nonce: str` | payment_token, expires_at, bundled_token | 委任チェーン検証後、EIP-3009 署名（USDC）を生成してバンドルトークンを返却 |
| `revoke_payment_credential` | `payment_token: str` | status | 発行済み x402 トークンを失効 |
| `list_x402_wallets` | — | wallets[](address, balance, network) | ユーザの x402 ウォレット情報を返却 |

---

## 5. x402 PSP MCP（`x402_psp_mcp`）

x402 決済サービスプロバイダ向け MCP サーバ（詳細実装はリポジトリ参照）。

---

## MCP サーバの実装概要

| 項目 | 詳細 |
| --- | --- |
| フレームワーク | FastMCP |
| デコレータ | `@mcp.tool()` |
| トランスポート | stdio（標準入出力） |
| 署名アルゴリズム | ES256（カード系）、EIP-712 / EIP-3009（x402） |
| Mandate 検証 | AP2 Python SDK（`code/sdk/python/ap2/sdk/mandate.py`） |

---

## 開発状況（FAQ より）

> "We are working on an SDK and a MCP server right now, in collaboration with payment service providers."（`docs/faq.md` Q5）

- v0.2 時点でサンプル実装（上記 5 種）は提供済み
- **FIDO Alliance での標準化は進行中**
- 商用決済サービスプロバイダとの協業で SDK と MCP サーバを整備中
- 対応フレームワーク: LangGraph、AG2、CrewAI 等（ADK / A2A 非必須）

---

## MCP ツール呼び出しフロー（HNP シナリオ）

```
Shopping Agent
  │
  ├─ [search_inventory] ──────────────→ merchant_agent_mcp
  ├─ [check_product] ─────────────────→ merchant_agent_mcp
  ├─ [assemble_cart] ─────────────────→ merchant_agent_mcp
  ├─ [create_checkout] ───────────────→ merchant_agent_mcp
  │                                        │
  │                               Checkout JWT 返却
  │
  ├─ [issue_payment_credential] ──────→ credentials_provider_mcp
  │                                        │
  │                               payment_token 返却
  │
  ├─ [complete_checkout] ─────────────→ merchant_agent_mcp
  │                                        │
  │                               [initiate_payment] ──→ merchant_payment_processor_mcp
  │                                                          │
  │                                                  payment_receipt 返却
  │
  └─ 購入完了
```
