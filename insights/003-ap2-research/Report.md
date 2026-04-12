# 調査レポート

## 対象Issue

* **参照**: [AP2の理解 #4](https://github.com/atakedemo/agent-commerce-research/issues/4)
* **追補指示（コメント）**: [Issue #4 コメント（2026-04-12）](https://github.com/atakedemo/agent-commerce-research/issues/4#issuecomment-4230817462) にて、(1) 調査 Must に [Python サンプル](https://github.com/google-agentic-commerce/AP2/tree/main/samples/python) を含めること、(2) **データモデル**（Cart / Intent / Payment Mandate、`PaymentRequest`）の詳細化、(3) サンプルについて **リクエスト元・先・場面** と **コードブロック**での整理、(4) **IF** として A2A 拡張の組み込み（対象エンドポイント、リクエストボディ／パラメータ・記載例）が求められた。
* **タイトル**: AP2の理解
* **内容の要約**: データソースとして [google-agentic-commerce/AP2](https://github.com/google-agentic-commerce/AP2) を指定し、**(1) 対象ディレクトリの構造**、**(2) 規格で定めている内容（データモデル、IF 定義、認証認可）**、**(3) 個別調査トピック（サポートする決済手段、MCP サポートの状況）**、**(4) 検討状況（活発な Issue、最新リリースの範囲）** を整理することが求められている。

## 調査対象ディレクトリ

* **パス**: `insights/003-ap2-research/`
* **確認したファイル**: 本ディレクトリの `README.md`、および `README.md` の **Must / Should** に従い参照した `references/specification/community/AP2/` 配下の仕様・ドキュメント・型定義。追補に従い **`references/specification/community/AP2/samples/python/`**（Shopping / Merchant / Credentials Provider 各ロールのツール・A2A クライアント・サーバ起動）を追加確認した。GitHub 上の [AP2](https://github.com/google-agentic-commerce/AP2) については、リリース情報および open Issue の一覧（API）を補助的に参照した。

## エグゼクティブサマリー

AP2 は **Mandate と W3C Payment Request 由来オブジェクト**で決済意図を構造化し、**A2A の `Message` / `Artifact` の DataPart** に載せてエージェント間でやり取りする。**HTTP の「REST リソース一覧」より、AgentCard（well-known）＋ JSON-RPC 系トランスポート上の `send_message` と拡張ヘッダ**が実装上の接点になる。Python サンプルでは **Shopping Agent → Merchant Agent** に `IntentMandate` や `PaymentMandate` を載せた A2A メッセージを送り、**Merchant が `CartMandate` を Artifact で返す**など、仕様の DataPart キーと一致するフローが実装されている。**MCP 向け標準バインディングは文書上ロードマップ**に留まりやすく、本サンプル主軸は A2A である。

## Issue要約

* **目的**: AP2 プロトコルについて、指定データソースに基づき論点を整理する。
* **論点（Issue 本文より）**:
  * 対象ディレクトリの構造
  * 規格: データモデル、IF 定義、認証認可
  * 個別: サポートする決済手段、MCP サポートの状況
  * 検討状況: 議論が集中している Issue、最新リリースに含まれる内容
* **追補（コメントより）**:
  * `samples/python` を Must 参照に加える
  * 上記 4 種データモデルの**フィールド単位の詳細**と、サンプルにおける **通信の端点・局面・コード例**
  * IF は **A2A 拡張としての埋め込み**（エンドポイント、ボディ／パラメータ、サンプル記載）

## 分析

### 対象ディレクトリの構造

リポジトリは **サンプル実装・型定義・MkDocs 仕様**の三層に分かれている。ルート `README.md` は **`samples`** を主要デモ領域とし、シナリオは `samples/python/scenarios` および `samples/android/scenarios` に配置されると明示している。中核のプロトコル記述は **`docs/`**（`specification.md`、`topics/`、`a2a-extension.md` 等）、機械可読な型は **`src/ap2/types/`** に集約されている。Python サンプルの実行エントリはシナリオ別 `run.sh` と、`samples/python/src/roles/` 配下の **ロール別エージェント＋`common/`（A2A サーバ・クライアント）** からなる。第2階層の概観は次のとおりである。

```
AP2/
├── docs/                 # 仕様本文・トピック別解説・ロードマップ（MkDocs）
├── src/ap2/types/        # Mandate・W3C Payment Request 由来オブジェクト等（Pydantic）
├── samples/              # python / go / android の参照実装・シナリオ
├── .github/              # CI、release-please 等
└── README.md, CHANGELOG.md, mkdocs.yml, ...
```

### 規格にて定めている内容

#### データモデル

以下は **`src/ap2/types/mandate.py`** および **`src/ap2/types/payment_request.py`** における主フィールドと、**`docs/specification.md` Section 4–5** の意味づけの対応である（自然言語仕様と型は版により微妙差がありうるが、ミラー上はこう対応している）。

各項目では、説明のあとに **① ワイヤ上のデータ例（JSON または sd-jwt-vc 等のトークン列）** と **② リポジトリ内の実装サンプル（Python）** を対で示す。

##### **1. Intent Mandate（`IntentMandate`）**

| フィールド（型） | 意味・役割 |
| --- | --- |
| `user_cart_confirmation_required` | 確定カート承認が必須か。未署名 Intent では `true` 必須等の制約が Docstring で述べられる。 |
| `natural_language_description` | SA が生成しユーザが確認する自然文の購買意図。 |
| `merchants` / `skus` | 許容マーチャント・SKU の限定（任意）。 |
| `requires_refundability` | 返金必須フラグ。 |
| `intent_expiry` | ISO 8601 形式の有効期限。 |

**Human-not-present** では同 Mandate がユーザ署名付きで決済の根拠になりうる、という位置づけが仕様書側で説明される。

**① データ例（A2A `Message` の DataPart 内 JSON）** 

出典: `docs/a2a-extension.md`（IntentMandate Message）
* A2A ラッパの `messageId` / `contextId` / `parts` と、`data["ap2.mandates.IntentMandate"]` に入る
* 仕様の JSON 例では `required_refundability` 表記。Pydantic 型は `requires_refundability`（`mandate.py`）であり、相互運用時はキー名の整合を要確認。

```json
{
  "messageId": "e0b84c60-3f5f-4234-adc6-91f2b73b19e5",
  "contextId": "sample-payment-context",
  "taskId": "sample-payment-task",
  "role": "user",
  "parts": [
    {
      "kind": "data",
      "data": {
        "ap2.mandates.IntentMandate": {
          "user_cart_confirmation_required": false,
          "natural_language_description": "I'd like some cool red shoes in my size",
          "merchants": null,
          "skus": null,
          "required_refundability": true,
          "intent_expiry": "2025-09-16T15:00:00Z"
        }
      }
    }
  ]
}
```

**② 実装例（Python）** 

* `IntentMandate` を組み立てて state に保持する（Shopper サブエージェント）。

```python
# references/specification/community/AP2/samples/python/src/roles/shopping_agent/subagents/shopper/tools.py
intent_mandate = IntentMandate(
    natural_language_description=natural_language_description,
    user_cart_confirmation_required=user_cart_confirmation_required,
    merchants=merchants,
    skus=skus,
    requires_refundability=requires_refundability,
    intent_expiry=(
        datetime.now(timezone.utc) + timedelta(days=1)
    ).isoformat(),
)
tool_context.state["intent_mandate"] = intent_mandate
```

##### **2. Cart Mandate（`CartMandate`）**

| フィールド（型） | 意味・役割 |
| --- | --- |
| `contents`（`CartContents`） | カート本体。 |
| `merchant_authorization` | マーチャントがカート内容を束ねる **JWT**（`cart_hash`・短寿命 `exp` 等）の想定が Docstring で詳述される。 |

* `CartContents` は **`id`**, **`user_cart_confirmation_required`**, **`payment_request`**（後述 `PaymentRequest`）, **`cart_expiry`**, **`merchant_name`** を持つ
* 仕様上「価格に影響する情報が揃うまで CartMandate を出さない」旨が `docs/a2a-extension.md` に記載あり
* 下記は文書例だが、Pydantic では `CartContents.user_cart_confirmation_required`、`CartMandate.merchant_authorization` 等の**フィールド名が一部異なる**（`docs/a2a-extension.md` 付近の例と `mandate.py` の対応表は IF 節の注意も参照）

**① データ例（A2A `Artifact` の DataPart 内 JSON）** 

出典: `docs/a2a-extension.md`（CartMandate Artifact）

* `contents.payment_request` がネストした `PaymentRequest` に相当
* 末尾の `risk_data` は実装定義のシグナル（JWT 風の文字列例）

```json
{
  "name": "Fancy Cart Details",
  "artifactId": "artifact_001",
  "parts": [
    {
      "kind": "data",
      "data": {
        "ap2.mandates.CartMandate": {
          "contents": {
            "id": "cart_shoes_123",
            "user_signature_required": false,
            "payment_request": {
              "method_data": [
                {
                  "supported_methods": "CARD",
                  "data": {
                    "payment_processor_url": "http://example.com/pay"
                  }
                }
              ],
              "details": {
                "id": "order_shoes_123",
                "displayItems": [
                  {
                    "label": "Cool Shoes Max",
                    "amount": {
                      "currency": "USD",
                      "value": 120.0
                    },
                    "pending": null
                  }
                ],
                "shipping_options": null,
                "modifiers": null,
                "total": {
                  "label": "Total",
                  "amount": {
                    "currency": "USD",
                    "value": 120.0
                  },
                  "pending": null
                }
              },
              "options": {
                "requestPayerName": false,
                "requestPayerEmail": false,
                "requestPayerPhone": false,
                "requestShipping": true,
                "shippingType": null
              }
            }
          },
          "merchant_signature": "sig_merchant_shoes_abc1",
          "timestamp": "2025-08-26T19:36:36.377022Z"
        }
      }
    },
    {
      "kind": "data",
      "data": {
        "risk_data": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...fake_risk_data"
      }
    }
  ]
}
```

**② 実装例（Python）** 

Merchant 側カタログサブエージェントが `CartContents` と `CartMandate` を生成し、Artifact の DataPart に `model_dump()` する。

```python
# references/specification/community/AP2/samples/python/src/roles/merchant_agent/sub_agents/catalog_agent.py（抜粋）
payment_request = PaymentRequest(
    method_data=method_data,
    details=PaymentDetailsInit(
        id=f"order_{item_count}",
        display_items=[item],
        total=PaymentItem(
            label="Total",
            amount=item.amount,
        ),
    ),
    options=PaymentOptions(request_shipping=True),
)
cart_contents = CartContents(
    id=f"cart_{item_count}",
    user_cart_confirmation_required=True,
    payment_request=payment_request,
    cart_expiry=(current_time + timedelta(minutes=30)).isoformat(),
    merchant_name="Generic Merchant",
)
cart_mandate = CartMandate(contents=cart_contents)
await updater.add_artifact([
    Part(
        root=DataPart(data={CART_MANDATE_DATA_KEY: cart_mandate.model_dump()})
    )
])
```

##### **3. Payment Mandate（`PaymentMandate`）**

| フィールド（型） | 意味・役割 |
| --- | --- |
| `payment_mandate_contents`（`PaymentMandateContents`） | 決済指示の実体。 |
| `user_authorization` | ユーザ側の**検証可能提示**（例: sd-jwt-vc 想定の説明）で、`user_authorization` Docstring に列挙される。 |

* `PaymentMandateContents` は **`payment_mandate_id`**, **`payment_details_id`**（`PaymentRequest.details.id` と対応）, **`payment_details_total`**（`PaymentItem`）, **`payment_response`**（ユーザが選択した方法と `details`）, **`merchant_agent`**, **`timestamp`** を持つ
* 仕様は、ネットワーク（Visa, Mastercardなど）／イシュアへの**エージェント取引の可視化**を目的とする（`PaymentMandate` クラス Docstring、`docs/specification.md` Section 4.1.3）。

**① データ例（A2A `Message` の DataPart 内 JSON ＋ sd-jwt-vc 想定のトークン列）** 

出典: `docs/a2a-extension.md`（PaymentMandate Message）

* `user_authorization` は **SD-JWT ベースの Verifiable Presentation** を想定した base64url 風のプレースホルダ（実装では issuer JWT・key-binding JWT・`transaction_data` 等を束ねる旨が `mandate.py` Docstring に記載）。

```json
{
  "messageId": "b5951b1a-8d5b-4ad3-a06f-92bf74e76589",
  "contextId": "sample-payment-context",
  "taskId": "sample-payment-task",
  "role": "user",
  "parts": [
    {
      "kind": "data",
      "data": {
        "ap2.mandates.PaymentMandate": {
          "payment_mandate_contents": {
            "payment_mandate_id": "pm_12345",
            "payment_details_id": "order_shoes_123",
            "payment_details_total": {
              "label": "Total",
              "amount": {
                "currency": "USD",
                "value": 120.0
              },
              "pending": null,
              "refund_period": 30
            },
            "payment_response": {
              "request_id": "order_shoes_123",
              "method_name": "CARD",
              "details": {
                "token": "xyz789"
              },
              "shipping_address": null,
              "shipping_option": null,
              "payer_name": null,
              "payer_email": null,
              "payer_phone": null
            },
            "merchant_agent": "MerchantAgent",
            "timestamp": "2025-08-26T19:36:36.377022Z"
          },
          "user_authorization": "eyJhbGciOiJFUzI1NksiLCJraWQiOiJkaWQ6ZXhhbXBsZ..."
        }
      }
    }
  ]
}
```

**② 実装例（Python）** 

* Shopping Agent の `create_payment_mandate` で `PaymentMandate` を生成
* 続く `sign_mandates_on_user_device` で `user_authorization` を代入する（サンプルはハッシュ連結のプレースホルダ。本番では sd-jwt-vc 等へ置換）

```python
# references/specification/community/AP2/samples/python/src/roles/shopping_agent/tools.py（抜粋）
payment_response = PaymentResponse(
    request_id=payment_request.details.id,
    method_name=method_name,
    details=details,
    shipping_address=shipping_address,
    payer_email=user_email,
)
payment_mandate = PaymentMandate(
    payment_mandate_contents=PaymentMandateContents(
        payment_mandate_id=uuid.uuid4().hex,
        timestamp=datetime.now(timezone.utc).isoformat(),
        payment_details_id=payment_request.details.id,
        payment_details_total=payment_request.details.total,
        payment_response=payment_response,
        merchant_agent=cart_mandate.contents.merchant_name,
    ),
)
# sign_mandates_on_user_device（別関数）で user_authorization を付与
payment_mandate.user_authorization = cart_mandate_hash + "_" + payment_mandate_hash
```

##### **4. Payment Request（`PaymentRequest`）**

W3C Payment Request API の Python モデル化。
* **`method_data`**（`PaymentMethodData` の列：`supported_methods` とメソッド固有情報 `data`
* **`details`**（`PaymentDetailsInit`：`id`, `display_items`, `shipping_options`, `modifiers`, `total` 等）
* **`options`**（支払人情報・配送要求フラグ） *任意
* **`shipping_address`**（`ContactAddress`） *任意

**① データ例（JSON — `CartMandate.contents.payment_request` にネストされる形の抜粋）

出典: `docs/a2a-extension.md` の Cart 例から `payment_request` オブジェクトのみ

* W3C 側の慣例で `displayItems` / `requestPayerName` 等が **camelCase** になる場合がある（Python モデルは snake_case）。

```json
{
  "method_data": [
    {
      "supported_methods": "CARD",
      "data": {
        "payment_processor_url": "http://example.com/pay"
      }
    }
  ],
  "details": {
    "id": "order_shoes_123",
    "displayItems": [
      {
        "label": "Cool Shoes Max",
        "amount": {
          "currency": "USD",
          "value": 120.0
        },
        "pending": null
      }
    ],
    "shipping_options": null,
    "modifiers": null,
    "total": {
      "label": "Total",
      "amount": {
        "currency": "USD",
        "value": 120.0
      },
      "pending": null
    }
  },
  "options": {
    "requestPayerName": false,
    "requestPayerEmail": false,
    "requestPayerPhone": false,
    "requestShipping": true,
    "shippingType": null
  }
}
```

**② 実装例（Python）** 

* 上記 **2.** の `catalog_agent.py` と同様に `PaymentRequest` を構築するほか、型定義は `payment_request.py` に集約される。

```python
# references/specification/community/AP2/samples/python/src/roles/merchant_agent/sub_agents/catalog_agent.py（抜粋・CARD 分岐）
method_data = [
    PaymentMethodData(
        supported_methods="CARD",
        data={
            "network": ["mastercard", "paypal", "amex"],
        },
    )
]
payment_request = PaymentRequest(
    method_data=method_data,
    details=PaymentDetailsInit(
        id=f"order_{item_count}",
        display_items=[item],
        total=PaymentItem(
            label="Total",
            amount=item.amount,
        ),
    ),
    options=PaymentOptions(request_shipping=True),
)
```

##### サンプルにおけるエンドツーエンド利用（場面の対応表）

| 場面 | リクエスト元 | リクエスト先 | 主に関わるモデル |
| --- | --- | --- | --- |
| A — 商品探索 | Shopping Agent<br>（Shopper サブエージェント） | Merchant Agent | `IntentMandate` を Message に載せる → `CartMandate` Artifact |
| B — カート更新（配送先） | Shopping Agent | Merchant Agent | 既存 `CartMandate` の更新 |
| C — 決済マンデート組立 | Shopping Agent<br>（ツール） | —（同一プロセス内で生成。CP への送信は別ツール） | `PaymentRequest` / `PaymentResponse` → `PaymentMandate` |
| D — 決済開始 | Shopping Agent | Merchant Agent | 署名済み `PaymentMandate` を Message に載せる |

場面 A・D の A2A 送信は、それぞれ **`find_products`（`shopper/tools.py`）** と **`initiate_payment`（`shopping_agent/tools.py`）** が `merchant_agent_client.send_a2a_message` を呼ぶ形で実装されている。

DataPart キー定数は `CART_MANDATE_DATA_KEY` = `"ap2.mandates.CartMandate"`、`INTENT_MANDATE_DATA_KEY`、`PAYMENT_MANDATE_DATA_KEY` が `mandate.py` で定義され、`docs/a2a-extension.md` の JSON 例と一致する。

#### IF 定義

**AP2 が組み込まれるプロトコルの前提は、A2A**である。REST のパスディスパッチではなく、次の**レイヤ**で IF が決まる。

**対象 URL・エンドポイント（A2A 実装の接点）**

1. **Agent Card（メタデータ）**  
* クライアントはベース URL に対し **A2A SDK が決める well-known パス**（`a2a.utils.constants.AGENT_CARD_WELL_KNOWN_PATH`）で `AgentCard` を取得する（`samples/python/src/common/payment_remote_a2a_client.py`）
* サンプルの `agent.json` 例ではurlに JSON-RPC のエージェント RPC 基底（例: `http://localhost:8001/a2a/merchant_agent`）、**`preferredTransport`**: `"JSONRPC"` が宣言される（`samples/python/src/roles/merchant_agent/agent.json`）。

1. **JSON-RPC（メッセージ送受信）**  
* `A2AStarletteApplication` 等により **指定 `rpc_url`** に JSON-RPC ハンドラが載る（`samples/python/src/common/server.py`）
* **クライアント**は `Client.send_message(message)` で **A2A `Message`** を送り、**`Task`**（`context_id`, `artifacts` 等）を受け取る。

1. **拡張交渉**  
* `AgentCard.capabilities.extensions` に **AP2 の拡張 URI**（サンプルでは `https://github.com/google-agentic-commerce/ap2/v1`）や決済手段拡張 URI が載る
* クライアントは **`HTTP_EXTENSION_HEADER`**（`a2a.extensions.common`）に必要拡張を列挙してクライアントを生成する（`PaymentRemoteA2aClient`）。

**AP2 仕様が「どこに」組み込まれるか**

| 埋め込み先（A2A 構造） | AP2 の入り方 |
| --- | --- |
| `AgentCard.capabilities.extensions[]` | `uri`・`params.roles`（`docs/a2a-extension.md` の JSON Schema）で AP2 対応とロールを宣言。 |
| `Message.parts[]`（`kind: data`） | `data["ap2.mandates.IntentMandate"]` または `data["ap2.mandates.PaymentMandate"]` 等。任意で `risk_data`。 |
| `Artifact.parts[]`（`kind: data`） | `data["ap2.mandates.CartMandate"]` とオプションの `risk_data`。 |

**ドキュメント上の JSON 記載例**は `docs/a2a-extension.md` の Intent / Cart Artifact / PaymentMandate Message の各ブロックがそのまま「パラメータ記載例」になる。サンプルコード側は上表のとおり **`A2aMessageBuilder` が同等の `add_data(キー, dict|Pydantic model)`** を積み上げている。

**注意**: `docs/a2a-extension.md` の拡張 URI は `https://github.com/google-agentic-commerce/ap2/tree/v0.1` 表記であり、`agent.json` サンプルの `https://github.com/google-agentic-commerce/ap2/v1` とは**文字列が一致しない**。相互運用時は**実際に参照する拡張 URI の一本化**が未解決になりうる（下文「未解決事項」参照）。

#### 認証認可

「認証認可」は **OAuth 一発の API 仕様**という形ではなく、次の積み上げとして記述される。

* **Mandate の暗号署名**（ユーザ・マーチャント等の非改ざん性）
* **ロール分離**（ショッピング経路と PCI/PII を扱う CP の分離）（`docs/topics/privacy-and-security.md`）
* **短期の信頼**としての **手動キュレーションされたレジストリ／許可リスト**（`docs/specification.md` Section 3.2.1）
* **長期**として **HTTPS、DNS、mTLS、API キー交換**等への期待（Section 3.2.2）
* **ステップアップチャレンジ**（3DS2、OTP 等）と **v0.1 でのリダイレクトチャレンジ**（Section 5.5）

サンプルの `sign_mandates_on_user_device` は**実署名のプレースホルダ**（ハッシュ連結）であり、本番では硬い鍵操作・VC に置き換える前提が Docstring で明示される。

### 個別調査トピック

#### サポートする決済手段

* **公式ロードマップ / v0.1**: **プル型（クレジット／デビット等）**が明示されている（`docs/specification.md` 冒頭ロードマップ、`docs/roadmap.md`）。
* **将来**: プッシュ型（口座振替、ウォレット等）、Human-not-present の拡張（同ロードマップ）。
* **x402 / 暗号資産**: `docs/topics/ap2-and-x402.md` で **x402 との補完**と **[a2a-x402](https://github.com/google-agentic-commerce/a2a-x402/) リポジトリとの整合予定**が述べられている。サンプルに **human-present の x402 シナリオ**（`samples/python/scenarios/a2a/human-present/x402/`）がある。`create_payment_mandate` は環境変数 `PAYMENT_METHOD=x402` のとき `method_name = "https://www.x402.org/"` とする分岐を含む。
* **話題としての stablecoin**: ドキュメントに stablecoin payments のトピック追加が進んでいる旨が、GitHub 上の直近の `docs:` 系コミット／Issue と整合する（詳細はリポジトリの `docs/topics/` を追う必要あり）。

#### MCP サポートの状況

* **文書上の位置づけ**: `docs/topics/ap2-a2a-and-mcp.md` は **MCP 用サーバを開発中**と明記する。`docs/roadmap.md` では **「AP2 MCP server v0.1」が未チェック**であり、**A2A 拡張 v0.1 や各 SDK も同様に未完了**として列挙されている。
* **解釈**: MCP は **トランスポート／ツール統合の重要層**として扱われるが、**v0.1 リリースタグと同時に完了した標準成果物**というより **ロードマップ上の次のマイルストーン**に近い。Python サンプルの **Must 参照は A2A 中心**であり、MCP 固有のツール定義はこのレイヤでは不足しがちである。

### 検討状況（Issue とリリース）

* **GitHub Releases**: 公開 API 上、**[v0.1.0（2025-09-16）](https://github.com/google-agentic-commerce/AP2/releases/tag/v0.1.0)** が最新。**本文は「Create Agent Payments Protocol (AP2)」**を主機能として挙げている。
* **CHANGELOG**: `CHANGELOG.md` も **0.1.0 のみ**で、内容は上記と一致する。
* **活発に見える open Issue（更新日ベースの抜粋）**: 仕様と実装の整合、Human-present の承認チェーン、AP2/A2A 契約層でのチャレンジフローの未定義、Mandate 周りのセキュリティ・型の不整合などを指摘する **Docs / Bug / Feat** が並んでいる（例: 「Human-present approval chain remains underdefined」「AP2 challenge flow underdefined at the AP2/A2A contract layer」など）。**依存関係バンプ**も多く、実装と仕様の両方が活発に動いている印象である。

## 未解決事項・不足情報

* **MCP**: 「MCP server v0.1」の**具体的なツール一覧・スキーマ・リリース時期**は、ロードマップとトピック文面以外の**確定ドキュメント**を本調査では深掘りしていない。
* **A2A 拡張 URI の表記ゆれ**: `docs/a2a-extension.md` とサンプル `agent.json` で **拡張 `uri` 文字列が一致しない**。運用上どちらを正とするか、あるいはバージョン管理方針の確認が必要。
* **認証認可の細目**: mTLS やレジストリの**運用プロファイル**は長期ビジョン寄りで、**相互運用テストに落ちた規範**としては不足しうる。
* **ワークスペースミラーと GitHub の完全一致**: `references/specification/community/AP2` は**特定時点のスナップショット**であり、**本日時点の `main` との差分**は自動では検証していない。
* **決済手段の網羅表**: カード＋x402 サンプル＋ stablecoin トピック等は確認できるが、**対応表を1枚にした公式マトリクス**は未確認である。

## 次のアクション

* **ローカルミラーを更新**する場合は、`references/specification/community/AP2` を upstream の `main`（または調査対象タグ）に合わせて再取得し、本レポートの該当章を差し替える。
* **拡張 URI の整合**: `docs/a2a-extension.md`・各 `agent.json`・リリースタグの**同一バージョンの URI**を突き合わせ、実装と仕様の差分 Issue の有無を確認する。
* **MCP 追跡**: `docs/roadmap.md` のチェックボックスと、リポジトリ内で `mcp` を検索した結果（新規 `servers/` 等の追加）を定期確認する。
* **決済手段**: `docs/topics/ap2-and-x402.md` と `a2a-x402` リポジトリの**リリース対応表**を横断し、AP2 型定義との対応を表形式で整理する。
* **議論の追従**: [AP2 Issues](https://github.com/google-agentic-commerce/AP2/issues) で **Documentation** ラベルや「underdefined」を含む項目をフィルし、仕様書の次版で解消されたかを確認する。

## 参照ファイル

* `insights/003-ap2-research/README.md`
* `references/specification/community/AP2/README.md`
* `references/specification/community/AP2/docs/specification.md`
* `references/specification/community/AP2/docs/a2a-extension.md`
* `references/specification/community/AP2/docs/topics/ap2-a2a-and-mcp.md`
* `references/specification/community/AP2/docs/topics/ap2-and-x402.md`
* `references/specification/community/AP2/docs/topics/privacy-and-security.md`
* `references/specification/community/AP2/docs/roadmap.md`
* `references/specification/community/AP2/src/ap2/types/mandate.py`
* `references/specification/community/AP2/src/ap2/types/payment_request.py`
* `references/specification/community/AP2/samples/python/src/roles/shopping_agent/tools.py`
* `references/specification/community/AP2/samples/python/src/roles/shopping_agent/subagents/shopper/tools.py`
* `references/specification/community/AP2/samples/python/src/roles/merchant_agent/sub_agents/catalog_agent.py`
* `references/specification/community/AP2/samples/python/src/common/payment_remote_a2a_client.py`
* `references/specification/community/AP2/samples/python/src/common/server.py`
* `references/specification/community/AP2/samples/python/src/roles/merchant_agent/agent.json`
* `references/specification/community/AP2/CHANGELOG.md`

## 主要ファクト

* **ディレクトリ**: `docs/` が仕様・MkDocs、`src/ap2/types/` が Mandate / Payment Request 系データモデル、`samples/python/src/` が A2A 連携の参照実装（ルート `README.md`＋コメント Must）。
* **データモデル**: `IntentMandate`、`CartMandate`（＋`CartContents`）、`PaymentMandate`（＋`PaymentMandateContents`）、`PaymentRequest` 樹形が `mandate.py` / `payment_request.py` と `docs/specification.md` で対応づく。
* **IF**: A2A の **AgentCard（well-known）**、**JSON-RPC メッセージ送受信**、**Message / Artifact の DataPart** に `ap2.mandates.*` キーで AP2 を埋め込む。拡張 URI は AgentCard と `HTTP_EXTENSION_HEADER` で運用。
* **Python サンプル**: Shopping → Merchant に `INTENT_MANDATE_DATA_KEY` や `PAYMENT_MANDATE_DATA_KEY` を載せた `Message` を送り、`CartMandate` は Merchant 側 **Artifact** として返るフローが `shopper/tools.py` / `shopping_agent/tools.py` にある。
* **認証認可**: Mandate 署名、ロール分離、許可リスト、将来の mTLS/DNS 等、および 3DS2 等のチャレンジ（`docs/specification.md` Section 3.2, 5.5、`docs/topics/privacy-and-security.md`）。サンプルのデバイス署名はプレースホルダ。
* **状態・ライフサイクル**: Human-present / not-present の違い、Intent の TTL・カート有効期限、チャレンジ時のユーザーオブザーバビリティ（`docs/specification.md` Section 5）。サンプルでは `task.context_id` をショッピング文脈に保存。
* **決済手段**: v0.1 はプル型カード中心；x402 は補完関係・別実装リポジトリと明示（`docs/topics/ap2-and-x402.md`）；`create_payment_mandate` が `CARD` / x402 URL を切替。
* **MCP**: トピック文面とロードマップに **AP2 MCP server v0.1（未チェック）**；Python Must サンプルは A2A 主軸。
* **リリース**: GitHub 上 **v0.1.0（2025-09-16）** が最新リリース、`CHANGELOG.md` も同内容。
* **GitHub 上の議論（API より）**: 文書の未定義箇所（Human-present 承認チェーン、AP2/A2A 境界のチャレンジ）に関する Issue が 2026年4月時点で更新されている。
