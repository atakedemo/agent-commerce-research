# 設計概要

このサンプルは、花屋の UCP Merchant Server を REST API として実装し、Discovery から Checkout 完了、注文参照、出荷シミュレーションまでの一連の流れを確認するための実装例である。

## 目的

このサンプルの主な目的は、UCP の shopping / order 系 API を FastAPI と SQLite でどう実装するかを示すことである。`client/flower_shop/simple_happy_path_client.py` がハッピーパスの呼び出し例を担い、`server/` が UCP 準拠のサーバと業務ロジックを担う。

## ディレクトリ構成

```text
samples/02-sample-restapi
├── client
│   └── flower_shop
│       ├── README.md
│       ├── pyproject.toml
│       ├── simple_happy_path_client.py   # Discovery から完了までを呼ぶサンプルクライアント
│       └── sample_output
├── server
│   ├── generated_routes
│   │   └── ucp_routes.py                 # 生成済み UCP ルート定義
│   ├── routes
│   │   ├── discovery.py                  # /.well-known/ucp
│   │   ├── discovery_profile.json        # Discovery テンプレート
│   │   ├── order.py                      # /orders と出荷シミュレーション
│   │   └── ucp_implementation.py         # 生成ルートへの実装差し込み
│   ├── services
│   │   ├── checkout_service.py           # チェックアウト・注文の中核ロジック
│   │   └── fulfillment_service.py        # 配送オプション計算
│   ├── db.py                             # SQLite モデルと永続化ヘルパー
│   ├── dependencies.py                   # FastAPI DI とヘッダ検証
│   ├── import_csv.py                     # CSV から DB へ初期投入
│   ├── integration_test.py               # API の統合テスト
│   ├── pyproject.toml
│   ├── README.md
│   └── server.py                         # FastAPI エントリーポイント
├── test_data
│   └── flower_shop
│       ├── products.csv
│       ├── discounts.csv
│       ├── promotions.csv
│       ├── shipping_rates.csv
│       └── ...
└── doc
    ├── design-overview.md
    ├── er.md
    └── sequence.md
```

## システム構成

- クライアント: `client/flower_shop/simple_happy_path_client.py` が `/.well-known/ucp`、`/checkout-sessions`、`/checkout-sessions/{id}/complete` などを順に呼び、支払い完了までを再現する
- API サーバ: `server/server.py` が FastAPI を起動し、`generated_routes/ucp_routes.py` の generated route に `routes/ucp_implementation.py` の実装を差し込む
- 補助 API: `routes/discovery.py` が Discovery Profile を返し、`routes/order.py` が注文取得と `POST /testing/simulate-shipping/{id}` を提供する
- ドメイン層: `services/checkout_service.py` が checkout / order の状態遷移、`services/fulfillment_service.py` が配送候補計算を担う
- 永続化層: `db.py` が 2 つの SQLite を扱い、`products.db` に商品系データ、`transactions.db` に在庫・顧客・注文系データを保持する
- 初期データ: `import_csv.py` が `test_data/flower_shop/*.csv` を各テーブルへ投入し、花屋サンプルの固定データを用意する

## 主要コンポーネント

### `client/flower_shop/simple_happy_path_client.py`

- 対応ファイル: `client/flower_shop/simple_happy_path_client.py`
- 責務: Discovery、Checkout 作成、商品追加、割引適用、配送先選択、配送オプション選択、決済完了を順番に実行する
- 補足: `--export_requests_to` が指定されると、送受信内容を Markdown と curl 断片で出力する

### `server/server.py`

- 対応ファイル: `server/server.py`
- 責務: FastAPI アプリを生成し、UCP 例外を JSON レスポンスへ変換し、generated route と補助 route を束ねる

### `routes/ucp_implementation.py`

- 対応ファイル: `server/routes/ucp_implementation.py`
- 責務: generated route の `create_checkout`、`update_checkout`、`complete_checkout`、`cancel_checkout`、`order_event_webhook` を実装に差し替える
- 補足: `UCP-Agent` ヘッダの `profile="..."` を使って Agent Profile を取得し、`webhook_url` を `PlatformConfig` に取り込む

### `dependencies.py`

- 対応ファイル: `server/dependencies.py`
- 責務: `UCP-Agent`、`Request-Signature`、`Request-Id`、`Idempotency-Key` を検証し、DB セッションと `CheckoutService` を DI する
- 補足: `Simulation-Secret` の検証もここに集約される

### `services/checkout_service.py`

- 対応ファイル: `server/services/checkout_service.py`
- 責務: チェックアウト生成、更新、完了、取消、注文取得、出荷イベント付与の本体処理を担う
- 補足: 商品価格の再計算、在庫確認、冪等性記録、注文生成、Webhook 通知を一箇所で管理する

### `services/fulfillment_service.py`

- 対応ファイル: `server/services/fulfillment_service.py`
- 責務: 配送先国、注文小計、対象商品、プロモーションから配送オプションを計算する
- 補足: `free_shipping` promotion が成立すると standard 配送料を 0 にする

### `db.py` / `import_csv.py`

- 対応ファイル: `server/db.py`, `server/import_csv.py`
- 責務: SQLAlchemy モデル、2 DB の初期化、CSV からのマスタ投入、永続化ヘルパーを提供する
- 補足: `CheckoutSession.data` と `Order.data` は UCP レスポンス全体を JSON として保存する

## 主要データ

- `Product`: `products.csv` から投入される商品マスタ。価格や表示名は常にここを正とする
- `Promotion`: 送料無料条件などの配送系プロモーション
- `Inventory`: 商品ごとの在庫数。完了時に `reserve_stock()` で減算される
- `Customer` / `CustomerAddress`: 購入者と既知配送先。buyer のメールアドレスから配送先候補を補完する
- `Discount`: `10OFF` などの割引コード定義
- `ShippingRate`: `standard` / `express` の配送レート定義
- `CheckoutSession`: checkout 状態と UCP checkout JSON 全体
- `Order`: 完了後に生成される注文 JSON 全体
- `IdempotencyRecord`: 同一キーでの再実行時にレスポンスを再利用するための記録
- `RequestLog`: チェックアウト系操作の簡易監査ログ

## リクエスト/状態の流れ

1. クライアントが `GET /.well-known/ucp` を呼び、`routes/discovery.py` が `discovery_profile.json` の `{{ENDPOINT}}` と `{{SHOP_ID}}` を差し替えて Discovery Profile を返す
2. クライアントが `POST /checkout-sessions` を呼ぶと、`routes/ucp_implementation.py` が `UnifiedCheckoutCreateRequest` に変換し、`CheckoutService.create_checkout()` に処理を委譲する
3. `CheckoutService` は line item ID を払い出し、商品 DB から価格・商品名を再計算し、在庫を確認したうえで `checkouts` と `idempotency_records` に保存する
4. `PUT /checkout-sessions/{id}` では line items、discounts、buyer、fulfillment を更新する。buyer のメールアドレスが既知なら配送先候補を DB から補完し、配送先選択後は `FulfillmentService.calculate_options()` が配送候補と送料を計算する
5. `POST /checkout-sessions/{id}/complete` では payment instrument と `risk_signals` を受け取り、決済ハンドラを検証したうえで、配送先と配送オプションが選択済みかを確認する
6. 完了可能であれば在庫を減算し、checkout を `completed` に更新して `Order` を生成し、`orders` と `checkouts` を保存する
7. `platform.webhook_url` が設定されていれば `order_placed` 通知を送信し、その後 `POST /testing/simulate-shipping/{id}` で shipped イベントを追加すると `order_shipped` 通知も送信する

## 制約と補足

- `Request-Signature` の検証はサンプル実装で、`test` をそのまま受け入れる簡易実装である
- `UCP-Agent` に含まれる version がサーバ実装バージョンより新しい場合は 400 を返す
- 決済は本番ゲートウェイ接続ではなく、`mock_payment_handler` の token 値で成功・失敗を分岐する
- `CheckoutSession` と `Order` は正規化された明細テーブルではなく、UCP JSON スナップショットとして保存される
- 配送オプションは永続マスタではなく、配送先・送料表・プロモーションから毎回再計算される
- Webhook URL の取得は外部 Agent Profile への HTTP アクセスに依存し、失敗時はログ出力のみで処理を継続する

## カスタマイズを行う対象

### クライアント

#### 実行フローと接続先

- 対象ファイル: `client/flower_shop/simple_happy_path_client.py`
- 主な変更点: `--server_url` の既定値、送信ヘッダ、実行ステップの順序や対象 API

```python
def get_headers() -> dict[str, str]:
  return {
    "UCP-Agent": 'profile="https://agent.example/profile"',
    "request-signature": "test",
    "idempotency-key": str(uuid.uuid4()),
    "request-id": str(uuid.uuid4()),
  }

parser.add_argument(
  "--server_url",
  default="http://localhost:8182",
  help="Base URL of the UCP Server",
)
```

#### リクエスト内容と決済データ

- 対象ファイル: `client/flower_shop/simple_happy_path_client.py`
- 主な変更点: 初回商品、追加商品、割引コード、配送先、決済トークン、利用する payment handler

```python
item1 = item_create_req.ItemCreateRequest(
  id="bouquet_roses", title="Red Rose"
)

update_dict["discounts"] = {"codes": ["10OFF"]}

credential = TokenCredentialResponse(type="token", token="success_token")
```

### バックエンド

#### Discovery と公開 capability

- 対象ファイル: `server/routes/discovery_profile.json`
- 主な変更点: 公開 endpoint、capabilities 一覧、payment handler の種類と設定

```json
{
  "services": {
    "dev.ucp.shopping": {
      "rest": {
        "endpoint": "{{ENDPOINT}}"
      }
    }
  },
  "capabilities": [
    { "name": "dev.ucp.shopping.checkout" },
    { "name": "dev.ucp.shopping.order" }
  ]
}
```

#### API 実装の差し込み

- 対象ファイル: `server/routes/ucp_implementation.py`
- 主な変更点: generated route への差し込み方、Webhook URL の抽出、complete API の入力変換

```python
webhook_url = await extract_webhook_url(common_headers.ucp_agent)
if webhook_url:
  platform_config = PlatformConfig(webhook_url=webhook_url)

checkout_result = await checkout_service.complete_checkout(
  checkout_id, payment_req, risk_signals, idempotency_key, ap2=ap2
)
```

#### ヘッダ検証と認証まわり

- 対象ファイル: `server/dependencies.py`
- 主な変更点: 必須ヘッダ、version negotiation、`Simulation-Secret` の扱い、署名検証の差し替え

```python
async def common_headers(
  x_api_key: str | None = Header(None),
  ucp_agent: str = Header(...),
  request_signature: str = Header(...),
  request_id: str = Header(...),
) -> CommonHeaders:
  await validate_ucp_headers(ucp_agent)
```

```python
async def verify_simulation_secret(
  simulation_secret: str | None = Header(None, alias="Simulation-Secret"),
) -> None:
  if not simulation_secret or simulation_secret != expected_secret:
    raise HTTPException(status_code=403, detail="Invalid Simulation Secret")
```

#### チェックアウト・配送・注文ロジック

- 対象ファイル: `server/services/checkout_service.py`, `server/services/fulfillment_service.py`
- 主な変更点: totals 再計算、割引条件、送料無料条件、完了条件、注文生成、Webhook 通知内容

```python
if checkout.discounts.codes:
  discounts = await db.get_discounts_by_codes(
    self.transactions_session, checkout.discounts.codes
  )
  if discount_obj.type == "percentage":
    discount_amount = int(grand_total * (discount_obj.value / 100))
```

```python
if promo.type == "free_shipping":
  if promo.min_subtotal and subtotal >= promo.min_subtotal:
    is_free_shipping = True
  if promo.eligible_item_ids and any(
    item_id in promo.eligible_item_ids for item_id in line_item_ids
  ):
    is_free_shipping = True
```

#### マスタデータと初期投入

- 対象ファイル: `server/import_csv.py`, `test_data/flower_shop/products.csv`, `test_data/flower_shop/discounts.csv`, `test_data/flower_shop/promotions.csv`, `test_data/flower_shop/shipping_rates.csv`
- 主な変更点: 商品カタログ、割引コード、送料無料条件、国別配送レート、CSV から投入するテーブル

```python
with (data_dir / "products.csv").open() as f:
  reader = csv.DictReader(f)
  for row in reader:
    products.append(
      Product(
        id=row["id"],
        title=row["title"],
        price=int(row["price"]),
        image_url=row["image_url"],
      )
    )
```
