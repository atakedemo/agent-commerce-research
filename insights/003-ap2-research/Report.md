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
* **User Credential 追加の正確な経緯**: CHANGELOG に記載なし。Issue・PR ベースでの追跡が必要。

---

## 追加調査結果

### 1. シーケンス図と公式画像の整合性

`docs/assets/` に以下の公式図が存在する（参照は [sequence_diagram.md](./sequence_diagram.md) 冒頭を参照）。

| カテゴリ | ファイル |
|---|---|
| HP 全体 | ap2_hp_flow.svg |
| HP ショッピング | ap2_hp_shopping.svg |
| HP 決済 | ap2_hp_payment.svg |
| HNP 全体 | ap2_hnp_flow.svg / ap2_hnp_flow.png |
| HNP ショッピング | ap2_hnp_shopping.svg |
| HNP 決済 | ap2_hnp_payment.svg |
| 認可概観 | action_authorization_overview.svg |
| Mandate 委譲（全体） | mandate_delegation_overview.svg |
| Mandate 委譲（User Credential） | mandate_delegation_user_credential.svg |
| Mandate 委譲（Trusted Agent Provider） | mandate_delegation_trusted_agent_provider.svg |

**整合性評価**: `docs/ap2/flows.md` の記述と本 Mermaid 図を照合した結果、全体の流れは一致。唯一の表現差異は、公式が HNP を「Phase 1a（Human Present 期）」「Phase 1b（Human Not Present 期）」に分けて示しているのに対し、本図では `rect` ブロックと `Note` で区切る形で1図内に統合している点。機能的な差異はない。

---

### 2. UCP との整合性

#### スコープの分担

AP2 は**決済認可層**を担い、商品探索・カート管理は UCP（またはそれに準ずる Commerce Protocol）に委譲する設計。

| プロセス | AP2 スコープ | UCP スコープ |
|---|---|---|
| 商品検索（search_catalog 等） | ❌ 対象外 | ✅ |
| カート構築（create_cart / update_cart） | ❌ 対象外 | ✅ |
| チェックアウト開始（checkout） | △ Mandate 層を追加 | ✅ エンドポイントを提供 |
| Checkout Mandate の生成・署名 | ✅ | ❌ |
| Payment Mandate の生成・署名 | ✅ | ❌ |
| 決済トークン発行・検証 | ✅ | ❌ |
| レシート発行（Checkout / Payment Receipt） | ✅ | ❌ |

#### 仕様上の明示的な言及

`docs/ap2/implementation_considerations.md` にて：

> "Merchants must 'Provide a Catalog and Checkout endpoints to the Shopping Agent to allow it to perform **a commerce protocol, for example as described by the Universal Commerce Protocol**.'"

AP2 は UCP の checkout エンドポイントを前提とし、その上に Mandate 層（署名・制約評価・トークン）を乗せる構造。**UCP の checkout が AP2 の create_checkout に対応し**、AP2 が Checkout JWT と Mandate で認可を補強する。

#### チェックアウトにおける共通プロセス

| ステップ | UCP 側の処理 | AP2 が追加する処理 |
|---|---|---|
| カート確定 | `create_checkout` / `update_checkout` | Open Checkout Mandate による制約検証 |
| Merchant 署名 | — | Checkout JWT（Merchant 署名）の発行 |
| ユーザ承認 | — | Trusted Surface で Mandate に user_sk 署名 |
| 決済完了 | `complete_checkout` | payment_token + Closed Mandate を提示 |

---

### 3. 各 Mandate の署名主体とデータ

#### Verifiable Intent との対応（L1 / L2 / L3 モデル）

[Verifiable Intent 仕様](https://github.com/agent-intent/verifiable-intent/blob/main/spec/credential-format.md)が定義する三層構造と AP2 Mandate の対応は以下のとおり。

| 層 | 形式 | 署名者 | 発行先・保管先 | AP2 での対応 |
|---|---|---|---|---|
| L1 | Issuer-signed SD-JWT | Credential Issuer（第三者） | **Trusted Surface**（TS が user_sk とペアで保管） | User Credential（身元証明） |
| L2 | User-signed KB-SD-JWT | Trusted Surface（user_sk） | Shopping Agent（TS → SA に **L1+L2 セット**で渡される） | Open Checkout Mandate + Open Payment Mandate |
| L3a | Agent-signed KB-SD-JWT | Shopping Agent（agent_sk） | Credential Provider / Network（SA → CP 経由） | Closed Payment Mandate → Network/CP へ提出 |
| L3b | Agent-signed KB-SD-JWT | Shopping Agent（agent_sk） | Merchant（SA → MA へ直接提示） | Closed Checkout Mandate → Merchant へ提出 |

L1 は Issuer が署名し **Trusted Surface に発行**される。TS はユーザ承認後に `Issuer_signed(UserCredential) + user_signed(Mandate)`（L1+L2）をセットで SA に渡す（[AP2 公式図: mandate_delegation_trusted_agent_provider.svg](https://raw.githubusercontent.com/google-agentic-commerce/AP2/main/docs/assets/mandate_delegation_trusted_agent_provider.svg) 参照）。SA はその後 L1 を CP・MA・NW に転送し、各検証者は Issuer の JWKS エンドポイントで L1 署名を独立検証する。

L2 は「Immediate モード（有効期限 ~15 分）」と「Autonomous モード（24 時間〜30 日）」があり、HNP では Autonomous モードが使用される。各層は `sd_hash` で前層にバインドされる。

#### Mandate 種別ごとの署名主体とデータ

| Mandate | vct | 署名主体 | 主要フィールド |
|---|---|---|---|
| **Open Checkout Mandate** | `mandate.checkout.open.1` | Shopping Agent が生成、Trusted Surface（user_sk）が署名 | `constraints[checkout.allowed_merchants]`、`constraints[checkout.line_items]`、`cnf`（SA の公開鍵） |
| **Closed Checkout Mandate** | `mandate.checkout.1` | Shopping Agent が生成・agent_sk で署名（HNP） / user_sk（HP） | `checkout_hash`（Merchant 署名 checkout_jwt の SHA-256）、`aud: "merchant"`、`nonce` |
| **Open Payment Mandate** | `mandate.payment.open.1` | Shopping Agent が生成、Trusted Surface（user_sk）が署名 | 8種の制約（amount_range, budget, allowed_payees, allowed_payment_instruments, agent_recurrence, allowed_pisps, execution_date, reference） |
| **Closed Payment Mandate** | `mandate.payment.1` | Shopping Agent が agent_sk で署名（HNP） / user_sk（HP） | `transaction_id`、`payee`、`payment_amount`、`payment_instrument`、`checkout_jwt_hash` |
| **Checkout JWT** | — | **Merchant** が署名 | `merchant`、`line_items`、`pricing`、`shipping/return policies` |

#### HP と HNP の署名主体の差異

| フェーズ | HP | HNP |
|---|---|---|
| Closed Mandate 署名 | Trusted Surface（user_sk、ユーザが生体認証等で承認） | Shopping Agent（agent_sk、自律署名） |
| Open Mandate 署名 | 不要（HP では都度 Closed を直接承認） | Trusted Surface（user_sk）が事前に署名 |

#### 各層の sd_hash に含める情報

[Verifiable Intent 仕様 §3–§5](https://github.com/agent-intent/verifiable-intent/blob/main/spec/credential-format.md) が定義する `sd_hash` は**各 KB-SD-JWT が前層のどのデータにバインドしているかを暗号的に固定**するフィールド。

| 層 | sd_hash の有無 | 計算式 | バインド対象 |
|---|---|---|---|
| **L1**（User Credential） | **なし**（MUST NOT contain `sd_hash`） | — | — |
| **L2**（Open Mandate） | あり | `B64U(SHA-256(ASCII(serialized_L1)))` | L1 全体（ base64url ヘッダ.ペイロード.署名 + `~` 区切りの全ディスクロージャ） |
| **L3a**（Closed Payment Mandate） | あり | `B64U(SHA-256(ASCII(L2_base_jwt + "~" + payment_disclosure + "~" + merchant_disclosure + "~")))` | L2 のうち Payment Mandate・Merchant の 2 ディスクロージャのみを選択提示した SD-JWT Presentation |
| **L3b**（Closed Checkout Mandate） | あり | `B64U(SHA-256(ASCII(L2_base_jwt + "~" + checkout_disclosure + "~" + item_disclosure + "~")))` | L2 のうち Checkout Mandate・Line Items の 2 ディスクロージャのみを選択提示した SD-JWT Presentation |

> **disclosure とは**
>
> SD-JWT では、選択的に開示したいクレームを JWT 本体に直接書かず、**disclosure** という別オブジェクトに分離する。
>
> ```
> disclosure = base64url( JSON( [ salt, claim_name, claim_value ] ) )
> ```
>
> JWT 本体の `_sd` 配列には各 disclosure の SHA-256 ハッシュだけが入り、disclosure 本体は `~` 区切りで添付される（例: `<base_jwt>~<disc_1>~<disc_2>~`）。提示時に holder（Shopping Agent）がどの disclosure を含めるかを選択することで、相手に見せる情報を制御する。
>
> L2 が持つ 4 つの disclosure の内訳：
>
> | 変数名 | claim_name（例） | claim_value の内容 |
> |---|---|---|
> | `payment_disclosure` | `"open_payment_mandate"` | Open Payment Mandate 全体（`vct`, `constraints[amount_range, allowed_payees, ...]`, `cnf`） |
> | `merchant_disclosure` | `"merchant"` | 支払先 Merchant の識別情報（`id`, `name`, `website`） |
> | `checkout_disclosure` | `"open_checkout_mandate"` | Open Checkout Mandate 全体（`vct`, `constraints[allowed_merchants, line_items]`, `cnf`） |
> | `item_disclosure` | `"line_items"` | 購入対象の Line Items（`id`, `acceptable_items`, `quantity`） |
>
> L3a は `payment_disclosure` + `merchant_disclosure` のみを提示 → Merchant や CP は何を購入するかを参照できない。  
> L3b は `checkout_disclosure` + `item_disclosure` のみを提示 → Merchant は Payment Instrument（カード情報等）を参照できない。

**ポイント:**

- L1 はイシュアーが署名した SD-JWT であるためバインド先が存在せず、`sd_hash` を含めることが禁止されている。
- L2 は L1 **全体**（すべてのディスクロージャを含む完全なシリアライズ文字列）を SHA-256 でハッシュする。これによりユーザ身元と公開鍵の紐付けを Open Mandate に固定する。
- L3a と L3b は L2 の**一部ディスクロージャのみ**を選択して提示し、その選択済みプレゼンテーション文字列をハッシュする。
  - L3a（決済側）は Payment Mandate と Merchant 情報のみを開示 → Network/CP は Checkout の詳細を参照できない。
  - L3b（チェックアウト側）は Checkout Mandate と Line Items のみを開示 → Merchant は Payment Instrument の詳細を参照できない。
- この「選択的開示」により、各検証者は自分の検証に必要な最小限の情報のみを受け取るプライバシー保護が実現される。

---

### 4. Trusted Surface の実体

#### 仕様上の定義

`docs/glossary.md`：

> "A secure, non-agentic interface that renders Mandate Content to the User for authorization and consent."

`docs/ap2/specification.md`：

> "The following role MUST be non-agentic: Trusted Surface"

`docs/ap2/implementation_considerations.md`：

> "May be implemented as **application components, standalone wallets, or platform user agents**."

#### Identity Wallet との関係

| 観点 | 内容 |
|---|---|
| 公式の呼称 | "Trusted Surface"（Identity Wallet という名称は仕様に登場しない） |
| 実装形態 | アプリコンポーネント・スタンドアロンウォレット・プラットフォームUA のいずれも可 |
| 主な役割 | Issuer から発行された **L1（User Credential）を保管**し、Mandate Content をユーザに提示して生体認証等で同意を取得、user_sk で L2 に署名した後、**L1+L2 をセットで SA へ渡す** |
| Credential Provider との違い | CP は"決済手段（Payment Credential）"を管理する別ロール。CP が "digital wallet" として実装されうるが、L1 の保管・管理は TS が担い、Trusted Surface とは別 |

**結論**: Trusted Surface は "Identity Wallet" とは明示されていない。シーケンス図から読み取れるように「ユーザ認証 UI + Mandate 署名」を担うコンポーネントであり、実装としてスタンドアロンウォレット（Identity Wallet に近い形）も許容されるが、規範的な名称は "Trusted Surface"。

---

### 5. User Credential が追加された経緯

#### CHANGELOG・Issue での記録

* `CHANGELOG.md` には v0.1.0（2025-09-16）と v0.2.0（2026-04-28）の2エントリのみ存在し、「User Credential 追加」に関する記述はない。
* 調査した Issue（#257 DID-based Settlement、#255 On-chain Settlement、#250 Post-Quantum 等）は直接的な追加経緯を示していない。

#### 仕様からの推察

`docs/ap2/agent_authorization.md` では、Mandate 委譲に**2つのトラストモデル**が並列定義されている。

| モデル | 概要 | 使用場面 |
|---|---|---|
| **User Credential Model** | 第三者 **Issuer**（CP とは別エンティティ）がユーザ身元と公開鍵をバインドした L1 SD-JWT を発行し **Trusted Surface に provisioning**。TS がユーザ承認後に L1+L2 を SA へ渡す。Verifier は共通の Issuer を信頼する。 | 1つの Credential で複数エージェントを認可したい場合 |
| **Trusted Agent Provider Model** | Agent Provider が認可を管理。Verifier は各 Provider を個別に信頼する。 | シンプルな 1:1 信頼関係 |

User Credential はこの「User Credential Model」の核心要素であり、**エージェントが複数存在する環境でユーザ身元の一元管理を実現**するために導入されたと推察される。具体的な追加経緯（Issue/PR）は CHANGELOG や公開 Issue から特定できず、設計当初（v0.1.0 以前）から組み込まれていた可能性が高い。

#### Verifiable Intent 仕様との整合

Verifiable Intent の L1 層（"Issuer-signed SD-JWT binding user identity and public key"）が User Credential に対応する。これはユーザの身元（`sub`）とエージェント公開鍵（`cnf.jwk`）を Issuer が署名することで第三者検証可能にする仕組みで、AP2 の Mandate チェーンにおける「**誰がエージェントに委譲したか**」の根拠となる。

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
