# 調査レポート

## 対象 Issue

* **参照**: [v0.2の内容確認 #11](https://github.com/atakedemo/agent-commerce-research/issues/11)
* **タイトル**: v0.2 の内容確認
* **内容の要約**: 2026-04-28 にリリースされた AP2 v0.2 の内容をまとめる。設計書（シーケンス図・状態遷移図・ER 図・API 一覧・MCP 一覧）の作成、v0.1 からの更新履歴の整理（`document_history.md`）、コントリビューター情報の記載（企業名含む）、`Report.md` の更新が求められた。

---

## 設計書一覧

| 設計書 | ファイル | 概要 |
| --- | --- | --- |
| シーケンス図 | [sequence_diagram.md](./sequence_diagram.md) | Human Present / Human Not Present の 2 フローを Mermaid で図示 |
| 状態遷移図 | [state_transition.md](./state_transition.md) | Mandate（Checkout / Payment）の Open → Closed → Receipt ライフサイクル |
| ER 図 | [er_diagram.md](./er_diagram.md) | Mandate・制約・Receipt・Merchant 間のデータモデルと関連 |
| API 一覧 | [api_list.md](./api_list.md) | 各ロールが提供する MCP ツール・A2A インターフェイスの一覧 |
| MCP 一覧 | [mcp_list.md](./mcp_list.md) | 5 種の MCP サーバと全ツールの引数・戻り値・概要 |

更新履歴は [document_history.md](./document_history.md) を参照。

---

## エグゼクティブサマリー

AP2 v0.2 は **Human Not Present（HNP）フローの提供**に重点を置いた第2リリース（2026-04-28）。v0.1 の 3 種 Mandate（IntentMandate / CartMandate / PaymentMandate）が **Checkout Mandate（Open/Closed）と Payment Mandate（Open/Closed）** の 4 状態モデルに再設計され、エージェントが制約の範囲内で自律的に購買・決済を完了できる仕組みが整備された。MCP サーバ実装が 5 種追加され、Merchant・CP・MPP すべてが MCP ツールとして呼び出せるようになった。ロールには **Trusted Surface（TS）** と **Merchant Payment Processor（MPP）** が新規追加された。

---

## v0.2 の主要変更点サマリー

### データモデルの再設計

| v0.1 | v0.2 | 変更内容 |
| --- | --- | --- |
| `IntentMandate` | — | Open Checkout Mandate の制約フィールドに統合 |
| `CartMandate` | `ClosedCheckoutMandate` | 名称変更・Open/Closed 分離 |
| — | `OpenCheckoutMandate` | 新規追加。制約（allowed_merchants, line_items）を含む |
| `PaymentMandate` | `ClosedPaymentMandate` | checkout_jwt_hash バインディングを明示 |
| — | `OpenPaymentMandate` | 新規追加。8 種の制約タイプを含む |
| `merchant_authorization` (JWT) | `CheckoutJWT` | Merchant 署名 JWT として独立 |
| — | `CheckoutReceipt` / `PaymentReceipt` | レシート型を正式定義 |

### ロールの追加

| ロール | v0.1 | v0.2 |
| --- | --- | --- |
| Shopping Agent (SA) | ✅ | ✅（HNP 対応強化・agent_sk 署名追加） |
| Credential Provider (CP) | ✅ | ✅（SD-JWT チェーン検証・制約評価を明示） |
| Merchant (M) | ✅ | ✅ |
| Merchant Payment Processor (MPP) | ❌ | ✅（新規追加） |
| Trusted Surface (TS) | ❌ | ✅（新規追加・非エージェント UI） |

### MCP サポート

| MCP サーバ | v0.1 | v0.2 |
| --- | --- | --- |
| `merchant_agent_mcp` | ❌ | ✅（5 ツール） |
| `credentials_provider_mcp` | ❌ | ✅（3 ツール） |
| `merchant_payment_processor_mcp` | ❌ | ✅（1 ツール） |
| `x402_credentials_provider_mcp` | ❌ | ✅（3 ツール） |
| `x402_psp_mcp` | ❌ | ✅ |

---

## 分析

### ディレクトリ構造（v0.2）

v0.2 でリポジトリ構造が大幅に再編された。

```
AP2/
├── docs/
│   ├── ap2/                  # 仕様書群（specification / flows / mandates / security など）
│   ├── faq.md
│   ├── glossary.md
│   ├── index.md
│   └── overview.md
├── code/
│   ├── sdk/
│   │   └── python/ap2/
│   │       ├── models/       # Pydantic データモデル
│   │       ├── schemas/      # JSON Schema
│   │       ├── sdk/          # Mandate 検証・署名ユーティリティ
│   │       └── tests/
│   ├── samples/
│   │   ├── python/           # Human Present / HNP シナリオ・ロール実装
│   │   ├── go/
│   │   ├── android/
│   │   └── certs/
│   └── web-client/           # Vite + React + TypeScript 製デモ UI
├── scripts/
└── README.md, CHANGELOG.md, mkdocs.yml, ...
```

**v0.1 から v0.2 への主なパス変更:**

- `src/ap2/types/` → `code/sdk/python/ap2/models/`
- `samples/python/` → `code/samples/python/`
- `docs/specification.md`（単一） → `docs/ap2/`（複数ファイル分割）

### フロー（Human Present / Human Not Present）

詳細なシーケンスは [`sequence_diagram.md`](./sequence_diagram.md) を参照。

#### Human Present（2 フェーズ）

1. **ショッピング**: SA が Open Mandate を提示しながら Merchant MCP で商品を探索・カートを構築し、Checkout JWT を取得
2. **承認・決済**: Trusted Surface でユーザが Closed Mandate に署名 → CP から payment_token 取得 → Merchant → MPP に決済処理

#### Human Not Present（3 フェーズ）

1. **事前承認（HP）**: ユーザが制約付き Open Mandate を TS で事前に承認・署名
2. **自律ショッピング（HNP）**: SA が制約を評価しながら Merchant MCP で自律的に商品を探索・カートを構築し、agent_sk で Closed Mandate に署名
3. **自律決済（HNP）**: SA が CP → Merchant → MPP に順次 MCP ツールを呼び出し購買を完了

### データモデル

詳細なフィールド定義と関連は [`er_diagram.md`](./er_diagram.md) を参照。

#### Checkout Mandate（Open/Closed）

**定義箇所:**

| 種別 | パス |
| --- | --- |
| 仕様書 | `docs/ap2/checkout_mandate.md` |
| Python 生成モデル（Open） | `code/sdk/python/ap2/sdk/generated/open_checkout_mandate.py` |
| Python 生成モデル（Closed） | `code/sdk/python/ap2/sdk/generated/checkout_mandate.py` |
| レシートモデル | `code/sdk/python/ap2/sdk/generated/checkout_receipt.py` |

**Open Checkout Mandate**（`vct=mandate.checkout.open.1`）: SA が生成。制約（`allowed_merchants`, `line_items`）と key binding（`cnf`）を含む。

```json
{
  "vct": "mandate.checkout.open.1",
  "constraints": [
    {
      "type": "checkout.line_items",
      "items": [
        {
          "id": "line_1",
          "acceptable_items": [{ "id": "BAB1234", "title": "Red Style" }],
          "quantity": 1
        }
      ]
    },
    {
      "type": "checkout.allowed_merchants",
      "allowed": [{ "id": "merchant_1", "name": "Demo Merchant" }]
    }
  ],
  "cnf": {
    "jwk": { "crv": "P-256", "kty": "EC",
             "x": "QpSyxPQHy38xckypDr54gZ3T42zj9iLtV4koyb5U27c",
             "y": "37HLd7JJinxjJIn8J7HijssoeclbfhdW-gUL7feI9lw" }
  },
  "iat": 1777342357,
  "exp": 1777345957
}
```

**Closed Checkout Mandate**（`vct=mandate.checkout.1`）: Merchant が Checkout JWT を発行後、SA が `checkout_jwt_hash` でバインド。SD-JWT 形式。

```json
{
  "vct": "mandate.checkout.1",
  "checkout_hash": "NivWhuqfzcvZNapvIEJ2-3tsdQLkiuIcye2g46WVgX8",
  "aud": "merchant",
  "nonce": "b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4",
  "iat": 1777342376
}
```

---

#### Payment Mandate（Open/Closed）

**定義箇所:**

| 種別 | パス |
| --- | --- |
| 仕様書 | `docs/ap2/payment_mandate.md` |
| Python 生成モデル（Open） | `code/sdk/python/ap2/sdk/generated/open_payment_mandate.py` |
| Python 生成モデル（Closed） | `code/sdk/python/ap2/sdk/generated/payment_mandate.py` |
| レシートモデル | `code/sdk/python/ap2/sdk/generated/payment_receipt.py` |

**Open Payment Mandate**（`vct=mandate.payment.open.1`）: SA が生成。8 種の制約（amount_range, budget, recurrence, allowed_payees 等）と key binding を含む。

```json
{
  "vct": "mandate.payment.open.1",
  "constraints": [
    {
      "type": "payment.amount_range",
      "currency": "USD",
      "max": 20000,
      "min": 0
    },
    {
      "type": "payment.allowed_payees",
      "allowed": [
        {
          "id": "merchant_1",
          "name": "Demo Merchant",
          "website": "https://demo-merchant.example"
        }
      ]
    },
    {
      "type": "payment.reference",
      "conditional_transaction_id": "FzLoxbbtgQGYZxoSM2NJYJtkFTSsdfUBoVEQ12k7JN8"
    }
  ],
  "cnf": {
    "jwk": { "crv": "P-256", "kty": "EC",
             "x": "QpSyxPQHy38xckypDr54gZ3T42zj9iLtV4koyb5U27c",
             "y": "37HLd7JJinxjJIn8J7HijssoeclbfhdW-gUL7feI9lw" }
  },
  "iat": 1777342357,
  "exp": 1777345957
}
```

**Closed Payment Mandate**（`vct=mandate.payment.1`）: `checkout_jwt_hash` でバインドしたトランザクション固有 Mandate。`payee`, `payment_amount`, `payment_instrument` を含む。

```json
{
  "vct": "mandate.payment.1",
  "transaction_id": "NivWhuqfzcvZNapvIEJ2-3tsdQLkiuIcye2g46WVgX8",
  "payee": {
    "id": "merchant_1",
    "name": "Demo Merchant",
    "website": "https://demo-merchant.example"
  },
  "payment_amount": {
    "amount": 19900,
    "currency": "USD"
  },
  "payment_instrument": {
    "id": "stub",
    "type": "card",
    "description": "Card ••••4242"
  }
}
```

**制約の追加例（Payment）:**

```json
{ "type": "payment.agent_recurrence", "frequency": "MONTHLY", "max_occurrences": 12 }
{ "type": "payment.budget", "max": 1000.00, "currency": "USD" }
{ "type": "payment.execution_date", "not_before": "2026-03-31T00:00:00Z", "not_after": "2026-04-30T23:59:59Z" }
```

---

#### Mandate チェーンの連結

`checkout_jwt_hash`（`Base64url(SHA-256(checkout_jwt))`）を共有キーとして Checkout Mandate と Payment Mandate が暗号的に連結される。これにより非否認性と二重使用防止を実現する。

### API / MCP インターフェイス

詳細は [`api_list.md`](./api_list.md) および [`mcp_list.md`](./mcp_list.md) を参照。

AP2 v0.2 の主要インターフェイスは REST ではなく **MCP ツール**として実装されている。サンプルは各ロールの `*_agent`（A2A）版と `*_mcp`（MCP）版を並行提供する。

#### MCP ツール数サマリー

| MCP サーバ | ツール数 |
| --- | --- |
| Merchant Agent | 5 |
| Credential Provider | 3 |
| Merchant Payment Processor | 1 |
| x402 Credential Provider | 3 |
| x402 PSP | 詳細未確認 |

### 認証認可

* **エージェント認可モデル**: ユーザが TS で Open Mandate に署名（委譲）→ 検証者がエージェントに Mandate 提示を要求（アクション認可）の 2 段階
* **2 つの委譲モデル**:
  1. **User Credential**: VDC 発行者が TS を通じてユーザ同意を確保。OpenID4VP で委譲
  2. **Trusted Agent Provider**: エージェント提供者が安全に保管した署名鍵で Mandate を作成
* **鍵管理**: `user_sk`（TS が管理、ユーザが生体認証で保護）、`agent_sk`（HNP で Closed Mandate に署名）
* **セキュリティ考慮点**（`docs/ap2/security_and_privacy_considerations.md`より）:
  - Checkout 操作の防止: Payment Mandate に関連 Checkout への参照を必須化
  - 二重使用防止: Action Receipt 受領まで新規 Mandate 作成禁止
  - 支払い認証情報の盗難: 単回用途トークン・決済完了後のみ発行

### サポートする決済手段

| 決済手段 | v0.1 | v0.2 |
| --- | --- | --- |
| カード（ES256 署名） | ✅ | ✅（整備） |
| x402（USDC / EIP-3009） | ✅（サンプルのみ） | ✅（専用 MCP 追加） |
| e-ウォレット・銀行振込 | ロードマップ | ロードマップ継続 |
| ステーブルコイン | ロードマップ | ロードマップ継続 |

### MCP の開発状況

> "We are working on an SDK and a MCP server right now, in collaboration with payment service providers."（`docs/faq.md` Q5）

v0.2 でサンプル実装 5 種が提供されたが、**FIDO Alliance での標準化は進行中**。FAQ では支払いサービスプロバイダとの協業が明記されている。

---

## コントリビューター情報（v0.2）

### v0.2 リリース関連 PR 担当者

| 氏名（GitHub） | 企業 | v0.2 での役割 | 関連 PR |
| --- | --- | --- | --- |
| yanheChen | Google（google-agentic-commerce org） | v0.2 実装作成・リリース PR 作成者 | [#233](https://github.com/google-agentic-commerce/AP2/pull/233), [#238](https://github.com/google-agentic-commerce/AP2/pull/238), [#246](https://github.com/google-agentic-commerce/AP2/pull/246) |
| GarethCOliver | Google（OpenID / FIDO 関連担当） | v0.2 リリースレビュー・担当者・貢献ガイドライン更新 | [#233](https://github.com/google-agentic-commerce/AP2/pull/233)（Reviewer）, [#240](https://github.com/google-agentic-commerce/AP2/pull/240) |
| kmcduffie（Kelly Seidl） | Google（Software Engineer & Payments Enthusiast） | CHANGELOG 更新 | [#239](https://github.com/google-agentic-commerce/AP2/pull/239) |

### その他主要コントリビューター（全体）

| GitHub ユーザー名 | 企業 | 主な貢献 |
| --- | --- | --- |
| joshlund-goog | Google | 初期仕様策定 |
| mdoeseckle | Google | 初期実装 |
| baembry-goog | Google | 初期実装 |
| holtskinner | Google | ドキュメント |
| stefanoamorelli | — | Go サンプル実装（PR #101） |
| zeroasterisk | — | コラボレーター |
| jorellis, abhinavrau, francescomiliani, vikkite, meetrick | — | 各種コントリビューター |

---

## 未解決事項・不足情報

* **x402_psp_mcp のツール詳細**: `code/samples/python/src/roles/x402_psp_mcp/server.py` の具体的なツール定義を未確認。
* **shopping_agent_v2 の実装差異**: `shopping_agent_v2` と `shopping_agent` の具体的な変更点が未確認。
* **A2A 版ロールの変更内容**: `*_agent` 版（A2A 実装）が v0.1 からどう変わったか未詳細。
* **SDK API の詳細**: `code/sdk/python/ap2/sdk/README.md` の内容（Mandate 検証・署名の具体的な API）を未確認。
* **FIDO 標準化の進捗**: FAQ で言及されている FIDO Alliance での標準化スケジュールは未確認。
* **Go / Android サンプルの v0.2 対応状況**: Python サンプルは確認済みだが、Go・Android の更新内容は未確認。

---

## 参照ファイル・URL

### GitHub（v0.2 / main ブランチ）

* `docs/overview.md`
* `docs/ap2/specification.md`
* `docs/ap2/flows.md`
* `docs/ap2/checkout_mandate.md`
* `docs/ap2/payment_mandate.md`
* `docs/ap2/agent_authorization.md`
* `docs/ap2/implementation_considerations.md`
* `docs/ap2/security_and_privacy_considerations.md`
* `docs/glossary.md`
* `docs/faq.md`
* `docs/index.md`
* `code/samples/python/src/roles/merchant_agent_mcp/server.py`
* `code/samples/python/src/roles/credentials_provider_mcp/server.py`
* `code/samples/python/src/roles/merchant_payment_processor_mcp/server.py`
* `code/samples/python/src/roles/x402_credentials_provider_mcp/server.py`
* [PR #233](https://github.com/google-agentic-commerce/AP2/pull/233)（Release AP2 v0.2）
* [Releases](https://github.com/google-agentic-commerce/AP2/releases)

### 本ディレクトリ

* [sequence_diagram.md](./sequence_diagram.md)
* [state_transition.md](./state_transition.md)
* [er_diagram.md](./er_diagram.md)
* [api_list.md](./api_list.md)
* [mcp_list.md](./mcp_list.md)
* [document_history.md](./document_history.md)
* [open-issues-filtered.md](./open-issues-filtered.md)

---

## 主要ファクト（v0.2）

* **リリース日**: 2026-04-28（v0.2.0、リリース者: GarethCOliver）
* **フォーカス**: Human Not Present（HNP）フローの提供
* **Mandate モデル**: Open/Closed × Checkout/Payment の 4 状態に再設計
* **制約システム**: Checkout 2 種・Payment 8 種の制約タイプを正式定義
* **新規ロール**: Trusted Surface（TS）・Merchant Payment Processor（MPP）
* **MCP**: 5 種の MCP サーバ実装を追加（merchant, CP, MPP, x402 CP, x402 PSP）
* **署名**: user_sk（HP）・agent_sk（HNP）の 2 鍵モデル、ES256 / EIP-3009 対応
* **ディレクトリ**: `src/` → `code/`、`docs/specification.md` → `docs/ap2/` に再編
* **テクノロジー**: Agent Development Kit（ADK）+ Gemini 3.1 Flash Lite Preview を使用（非必須）
* **標準化**: FIDO Alliance で標準化進行中（FAQ より）
