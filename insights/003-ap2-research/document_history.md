# 更新履歴

## v0.2.0（2026-04-28）

### 概要

> "This is the second release of AP2. It focuses on providing Human Not Present flows."（リリースノートより）

エージェントが自律的に購買・決済を完了する **Human Not Present（HNP）フロー**の提供に重点を置いた第2リリース。制約・署名モデルが整備され、MCP 実装が追加された。

---

### データモデルの変更

| v0.1 | v0.2 | 変更内容 |
| --- | --- | --- |
| `IntentMandate` | — | Open Checkout Mandate の制約フィールドに統合 |
| `CartMandate` | `ClosedCheckoutMandate`（`vct=mandate.checkout.1`） | 名称変更・Open/Closed を明示的に分離 |
| — | `OpenCheckoutMandate`（`vct=mandate.checkout.open.1`） | 新規追加。制約（allowed_merchants, line_items）を含む |
| `PaymentMandate` | `ClosedPaymentMandate`（`vct=mandate.payment.1`） | 名称整理・checkout_jwt_hash バインディングを明示 |
| — | `OpenPaymentMandate`（`vct=mandate.payment.open.1`） | 新規追加。8種の制約タイプを含む |
| `merchant_authorization`（JWT） | `CheckoutJWT` | Merchant 署名 JWT として独立したオブジェクトに昇格 |
| — | `CheckoutReceipt` / `PaymentReceipt` | レシート型を正式定義 |

---

### ロールの追加

| ロール | v0.1 | v0.2 | 変更内容 |
| --- | --- | --- | --- |
| Shopping Agent (SA) | ✅ | ✅ | HNP 対応強化。agent_sk による Mandate 署名を追加 |
| Credential Provider (CP) | ✅ | ✅ | SD-JWT チェーン検証・制約評価を明示 |
| Merchant (M) | ✅ | ✅ | 変更なし |
| Merchant Payment Processor (MPP) | ❌ | ✅ | 新規追加。決済処理・レシート発行を担当 |
| Trusted Surface (TS) | ❌ | ✅ | 新規追加。非エージェント UI。ユーザ同意取得専任 |

---

### フローの追加

| フロー | v0.1 | v0.2 |
| --- | --- | --- |
| Human Present（2フェーズ） | ✅（基盤のみ） | ✅（整備・文書化） |
| Human Not Present（3フェーズ） | ❌ | ✅（新規） |

---

### 制約システムの整備

v0.2 で正式定義された制約タイプ：

**Checkout 制約:**

| 制約タイプ | 概要 |
| --- | --- |
| `checkout.allowed_merchants` | 許可マーチャントを制限 |
| `checkout.line_items` | 許容商品・数量を制限（最大流アルゴリズムで評価） |

**Payment 制約:**

| 制約タイプ | 概要 |
| --- | --- |
| `agent_recurrence` | 繰り返し頻度・発生回数を制限 |
| `allowed_payees` | 許可マーチャントを制限 |
| `allowed_payment_instruments` | 許可決済手段を制限 |
| `allowed_pisps` | 許可 PSP を制限 |
| `amount_range` | 最小・最大金額を設定 |
| `budget` | 総支出上限を設定 |
| `reference` | 関連 Checkout Mandate を参照 |
| `execution_date` | 有効実行日時範囲を指定 |

---

### MCP サポートの追加

| MCP サーバ | v0.1 | v0.2 |
| --- | --- | --- |
| `merchant_agent_mcp` | ❌ | ✅（5ツール） |
| `credentials_provider_mcp` | ❌ | ✅（3ツール） |
| `merchant_payment_processor_mcp` | ❌ | ✅（1ツール） |
| `x402_credentials_provider_mcp` | ❌ | ✅（3ツール） |
| `x402_psp_mcp` | ❌ | ✅ |

---

### ディレクトリ構造の変更

| v0.1 パス | v0.2 パス | 変更内容 |
| --- | --- | --- |
| `src/ap2/types/` | `code/sdk/python/ap2/models/` | SDK 層として分離・整備 |
| `samples/python/` | `code/samples/python/` | `code/` 配下に統合 |
| — | `code/web-client/` | Vite + React + TypeScript の Web UI を追加 |
| `docs/specification.md`（単一） | `docs/ap2/specification.md` | サブディレクトリ分割 |
| `docs/a2a-extension.md` | `docs/ap2/flows.md` | フロー仕様を独立ファイルに |
| — | `docs/ap2/checkout_mandate.md` | Checkout Mandate 仕様を独立ファイルに |
| — | `docs/ap2/payment_mandate.md` | Payment Mandate 仕様を独立ファイルに |
| — | `docs/ap2/agent_authorization.md` | 認可モデルを独立ファイルに |
| — | `docs/ap2/implementation_considerations.md` | 実装ガイドを独立ファイルに |
| — | `docs/ap2/security_and_privacy_considerations.md` | セキュリティ・プライバシーを独立ファイルに |
| `docs/topics/` | `docs/` 直下へ整理 | トピック別ファイルを統合 |

---

### v0.2 関連 PR / Issue

| PR # | タイトル | 担当者 | 企業 | マージ日 |
| --- | --- | --- | --- | --- |
| [#233](https://github.com/google-agentic-commerce/AP2/pull/233) | feat: Release Ap2 v0.2 | yanheChen（作成）/ GarethCOliver（レビュー・担当） | Google | 2026-04-28 |
| [#239](https://github.com/google-agentic-commerce/AP2/pull/239) | docs: Update CHANGELOG.md | kmcduffie（Kelly Seidl） | Google | 2026-04-28 |
| [#240](https://github.com/google-agentic-commerce/AP2/pull/240) | docs: Update contribution guidelines | GarethCOliver | Google | 2026-04-28 |
| [#246](https://github.com/google-agentic-commerce/AP2/pull/246) | fix: remove uvlock | yanheChen | Google | 2026-04-29 |

---

## v0.1.0（2025-09-16）

### 概要

AP2 の初版リリース。Human Present フローの基盤プロトコルを提供。

### 主要な内容

- `IntentMandate`, `CartMandate`, `PaymentMandate` の定義
- Python サンプル（Shopping Agent / Merchant Agent / Credential Provider）の A2A 実装
- A2A 拡張仕様の提供（`docs/a2a-extension.md`）
- MCP 対応はロードマップ記載のみ（未実装）
- `docs/specification.md` / `docs/roadmap.md` / `docs/topics/` 等

### 主要コントリビューター（v0.1）

| ユーザー名 | 企業 | 主な役割 |
| --- | --- | --- |
| joshlund-goog | Google | 初期仕様策定 |
| mdoeseckle | Google | 初期実装 |
| baembry-goog | Google | 初期実装 |
| holtskinner | Google | ドキュメント |
| stefanoamorelli | — | Go サンプル実装（PR #101） |
