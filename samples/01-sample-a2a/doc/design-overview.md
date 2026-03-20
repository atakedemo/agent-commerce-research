# 設計概要

## 目的

`samples/01-sample-a2a/` は、A2A と UCP Extension を使って「チャット UI から商品検索し、チェックアウトを組み立て、支払いを完了する」流れを確認するためのサンプルである。フロントエンドの React アプリが A2A サーバーに JSON-RPC を送り、バックエンド側の ADK エージェントが `RetailStore` と `MockPaymentProcessor` を使ってショッピング処理を進める。

## ディレクトリ構成

```text
samples/01-sample-a2a
├── business_agent
│   ├── README.md
│   ├── pyproject.toml
│   └── src/business_agent
│       ├── main.py                  # A2A / Starlette / Uvicorn 起動
│       ├── agent_executor.py        # A2A request と ADK 実行の橋渡し
│       ├── agent.py                 # shopper_agent とツール群
│       ├── store.py                 # 商品検索・checkout・注文確定のインメモリ実装
│       ├── payment_processor.py     # 支払い成功を返すモック決済処理
│       ├── ucp_profile_resolver.py  # クライアント profile の解決と capability 交渉
│       ├── helpers/type_generator.py# UCP capability から Checkout 型を動的生成
│       ├── data/agent_card.json     # A2A agent card
│       ├── data/products.json       # 商品マスタ
│       └── data/ucp.json            # merchant 側 UCP / payment 定義
├── chat-agent
│   ├── App.tsx                      # 画面状態と A2A 通信の中心
│   ├── config.ts                    # 表示名・初期メッセージ
│   ├── types.ts                     # UI が使う Product / Checkout 型
│   ├── vite.config.ts               # `/api` をバックエンドへ proxy
│   ├── profile/agent_profile.json   # クライアント側 UCP profile
│   ├── mocks/credentialProviderProxy.ts
│   │                                # 支払い手段とトークンのモック供給
│   └── components                   # チャット、商品カード、checkout 表示
└── doc
    ├── design-overview.md
    ├── er.md
    └── sequence.md
```

## システム構成

- フロントエンドは `chat-agent/App.tsx` を中心とした React + Vite アプリで、ユーザー入力を JSON-RPC `message/send` に変換して `/api` へ送信する。
- `chat-agent/vite.config.ts` は `/api` を `http://localhost:10999` にリバースプロキシし、ブラウザから A2A サーバーを直接意識せずに通信できるようにする。
- バックエンドは `business_agent/main.py` で `A2AStarletteApplication` を起動し、`/.well-known/agent-card.json` と `/.well-known/ucp` を公開する。
- `business_agent/agent_executor.py` は A2A の `RequestContext` から UCP 関連ヘッダと data part を取り出し、ADK の `Runner` とセッション状態へ変換する。
- `business_agent/agent.py` の `shopper_agent` は自然言語または JSON action を受け、商品検索、checkout 更新、配送先登録、支払い完了などのツールを順次呼び出す。
- ドメイン処理は `business_agent/store.py` に集約され、商品一覧、checkout、注文はすべてプロセス内メモリで保持される。
- 決済は `business_agent/payment_processor.py` の `MockPaymentProcessor`、支払い手段取得は `chat-agent/mocks/credentialProviderProxy.ts` によるモック実装である。

## 主要コンポーネント

### `chat-agent/App.tsx`

- 画面のメッセージ列、`contextId`、`taskId`、ローディング状態を保持する。
- 送信時に `X-A2A-Extensions` と `UCP-Agent` ヘッダを付与し、UCP Extension の利用とクライアント profile URL をバックエンドへ伝える。
- 応答の `a2a.product_results` と `a2a.ucp.checkout` を解釈し、商品カードや checkout UI に変換する。

### `chat-agent/components/ChatMessage.tsx`

- テキスト、商品一覧、支払い手段選択、支払い確認、checkout 要約を 1 つのチャットメッセージ表現に統合する。
- 最後に表示された checkout のみ `Start Payment` / `Complete Payment` を操作可能にしている。

### `chat-agent/mocks/credentialProviderProxy.ts`

- 支払いハンドラ `example_payment_provider` 向けのカード候補を固定値で返す。
- 選択されたカードから `PaymentInstrument` を生成し、`a2a.ucp.checkout.payment_data` として送信できる形に変換する。

### `business_agent/main.py`

- `agent_card.json` を読み込み、`ADKAgentExecutor` と `InMemoryTaskStore` を組み合わせて A2A サーバーを構成する。
- 画像ファイルと merchant 側 `ucp.json` を追加ルートとして公開する。

### `business_agent/agent_executor.py`

- A2A リクエストから user query と payment data を抽出する。
- `ProfileResolver` を使ってクライアント profile を取得し、merchant 側 capability との共通集合から実行時 UCP metadata を組み立てる。
- ADK 実行後は tool response を `DataPart` または `TextPart` として A2A 応答へ戻す。

### `business_agent/agent.py`

- `shopper_agent` を定義し、`search_shopping_catalog`、`add_to_checkout`、`start_payment`、`complete_checkout` などのツールを公開する。
- checkout ID、UCP metadata、payment data、最新 tool 結果を ADK state に保存し、会話継続中に再利用する。
- UCP Extension が有効な場合は、tool の構造化レスポンスを最終応答として優先返却する。

### `business_agent/store.py`

- `products.json` と `ucp.json` を読み込み、商品マスタと payment handler 情報を初期化する。
- capability に応じて checkout 型を動的生成し、line item・配送・税・送料・注文確定を計算する。
- `continue_url` や `OrderConfirmation` を付与し、UI が checkout 状態をそのまま描画できるようにする。

### `business_agent/ucp_profile_resolver.py`

- `UCP-Agent` ヘッダ内の profile URL からクライアント profile を取得する。
- merchant より新しい UCP version を拒否し、共通 capability のみを `ResponseCheckout` に詰め直す。

## 主要データ

- `Product`: `data/products.json` から読み込む schema.org ベースの商品。`productID`、`name`、`offers.price`、`category`、`image` を持つ。
- `ProductResults`: `search_products()` の返却型。UI では横スクロールの商品カード群として表示される。
- `Checkout`: `helpers/type_generator.py` で capability に応じて動的生成される UCP SDK の checkout 応答型。`line_items`、`totals`、`payment`、`status` を持つ。
- `LineItem`: checkout 内の商品行。商品 ID、数量、行単位 total を保持する。
- `PaymentResponse`: merchant 側 `ucp.json` に定義された payment handler 群と、選択済み instrument 情報を保持する。
- `PaymentInstrument`: フロントエンドの `CredentialProviderProxy` が生成し、`complete_checkout` 時に data part で渡される支払い資格情報。
- `Fulfillment`: 配送先住所と配送オプション。クライアント profile と merchant profile の共通 capability に fulfillment が含まれる場合に checkout へ付与される。
- `OrderConfirmation`: `place_order()` で checkout 完了時に付与される注文確定情報。

## リクエスト/状態の流れ

1. ユーザーがチャット欄から商品を問い合わせると、`App.tsx` が JSON-RPC `message/send` を `/api` に送る。
2. バックエンドの `ADKAgentExecutor.execute()` が `UCP-Agent` ヘッダからクライアント profile を解決し、ADK state に UCP metadata と支払いデータを投入する。
3. `shopper_agent` は入力内容に応じて `search_shopping_catalog()` や `add_to_checkout()` を実行し、`RetailStore` で商品検索や checkout 更新を行う。
4. tool の戻り値は `after_tool_modifier()` により state へ保存され、`modify_output_after_agent()` が UCP 形式の構造化レスポンスとして返す。
5. フロントエンドは `a2a.product_results` を商品カード、`a2a.ucp.checkout` を checkout 要約として描画し、以後の操作に `contextId` を引き継ぐ。
6. 支払い開始時は `start_payment()` が buyer や fulfillment の不足を検査し、必要情報が不足していれば `requires_more_info` を返す。
7. UI で支払い手段が選択されると `CredentialProviderProxy` が `PaymentInstrument` を発行し、`complete_checkout` action と一緒に data part として送信する。
8. `complete_checkout()` は `MockPaymentProcessor.process_payment()` の成功を確認後、checkout に支払い instrument を反映し、`place_order()` で status を `completed` にして注文確定情報を返す。

## 制約と補足

- 商品、checkout、注文、A2A task store、ADK session はすべてインメモリで、永続化は行わない。
- 決済処理は `MockPaymentProcessor` が常に完了済み `Task` を返すだけで、外部決済サービスとの接続はない。
- 支払い手段取得も `CredentialProviderProxy` の固定値であり、実ユーザー認証や tokenization は行わない。
- `GOOGLE_API_KEY` が未設定だと `business_agent/main.py` は起動しない。LLM 実行自体は ADK / Gemini 依存である。
- `App.tsx` の `UCP-Agent` ヘッダは `http://localhost:3000/profile/agent_profile.json` を前提としており、フロントエンドの配信先変更時は合わせて更新が必要である。
- merchant 側 `agent_card.json` には discount capability が載っているが、`store.py` では discount 金額を常に 0 として扱う。

## カスタマイズを行う対象

### フロントエンド

#### 表示名・初期メッセージ

- 対象ファイル: `chat-agent/config.ts`
- 画面ヘッダ、ロゴ、最初の案内文を変更する箇所である。

```typescript
export const appConfig = new AppProperties(
  "Business Agent",
  "Your personal shopping assistant.",
  "/images/logo.jpg",
  "Hello, I am your Business Agent. How can I help you?",
  "Shop with Business Agent",
);
```

#### A2A 接続先と profile URL

- 対象ファイル: `chat-agent/vite.config.ts`
- 開発時の `/api` プロキシ先を変更する箇所である。

```typescript
server: {
  port: 3000,
  host: "0.0.0.0",
  proxy: {
    "/api": {
      target: "http://localhost:10999",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ""),
      secure: false,
    },
  },
},
```

- 対象ファイル: `chat-agent/App.tsx`
- A2A 送信時に使う extension ヘッダとクライアント profile URL を変更する箇所である。

```typescript
const defaultHeaders = {
  "Content-Type": "application/json",
  "X-A2A-Extensions":
    "https://ucp.dev/specification/reference?v=2026-01-11",
  "UCP-Agent":
    'profile="http://localhost:3000/profile/agent_profile.json"',
};
```

#### チャット UI と checkout 表示

- 対象ファイル: `chat-agent/components/ChatMessage.tsx`
- 商品一覧、支払い選択、checkout 要約をどの順で表示するかを制御する箇所である。

```typescript
{message.paymentMethods && onSelectPaymentMethod && (
  <PaymentMethodSelector
    paymentMethods={message.paymentMethods}
    onSelect={onSelectPaymentMethod}
  />
)}

{message.checkout && (
  <CheckoutComponent
    checkout={message.checkout}
    onCheckout={isLastCheckout ? onCheckout : undefined}
    onCompletePayment={isLastCheckout ? onCompletePayment : undefined}
  />
)}
```

- 対象ファイル: `chat-agent/components/Checkout.tsx`
- `Start Payment`、`Complete Payment`、注文完了リンクの出し分けを変更する箇所である。

```typescript
{onCheckout && (
  <button
    type="button"
    onClick={onCheckout}
    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm"
  >
    Start Payment
  </button>
)}
{onCompletePayment && (
  <button
    type="button"
    onClick={() => onCompletePayment?.(checkout)}
    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm"
  >
    Complete Payment
  </button>
)}
```

#### 支払い手段の供給方法

- 対象ファイル: `chat-agent/mocks/credentialProviderProxy.ts`
- モックのカード一覧や token 発行方法を、実際の credential provider API 呼び出しへ置き換える箇所である。

```typescript
async getPaymentToken(
  user_email: string,
  payment_method_id: string,
): Promise<PaymentInstrument | undefined> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const randomId = crypto.randomUUID();

  return {
    ...payment_method,
    handler_id: this.handler_id,
    handler_name: this.handler_name,
    credential: {
      type: "token",
      token: `mock_token_${randomId}`,
    },
  };
}
```

### バックエンド

#### 公開 capability と agent card

- 対象ファイル: `business_agent/src/business_agent/data/agent_card.json`
- A2A agent card に公開する extension capability を変更する箇所である。

```json
{
  "description": "UCP Extension",
  "required": true,
  "uri": "https://ucp.dev/specification/reference?v=2026-01-11",
  "params": {
    "capabilities": [
      {
        "name": "dev.ucp.shopping.checkout",
        "version": "2026-01-11"
      }
    ]
  }
}
```

- 対象ファイル: `business_agent/src/business_agent/data/ucp.json`
- merchant 側の UCP capability と payment handler 定義を変更する箇所である。

```json
{
  "ucp": {
    "version": "2026-01-11",
    "capabilities": [
      {
        "name": "dev.ucp.shopping.checkout",
        "version": "2026-01-11"
      },
      {
        "name": "dev.ucp.shopping.fulfillment",
        "version": "2026-01-11",
        "extends": "dev.ucp.shopping.checkout"
      }
    ]
  },
  "payment": {
    "handlers": [
      {
        "id": "example_payment_provider",
        "name": "example.payment.provider"
      }
    ]
  }
}
```

#### UCP profile 交渉

- 対象ファイル: `business_agent/src/business_agent/ucp_profile_resolver.py`
- クライアント profile の取得先、version の互換判定、共通 capability の抽出方法を変更する箇所である。

```python
client_version = profile.get("ucp").get("version")
merchant_version = self.merchant_profile.get("ucp").get("version")

client_version = datetime.strptime(client_version, "%Y-%m-%d").date()
merchant_version = datetime.strptime(merchant_version, "%Y-%m-%d").date()

if client_version > merchant_version:
    raise ServerError(
        error=InternalError(
            message=(
                f"Version {client_version} is not supported. "
                f"This merchant implements version {merchant_version}."
            )
        )
    )
```

#### エージェントのツール選択と応答方針

- 対象ファイル: `business_agent/src/business_agent/agent.py`
- エージェント instruction、公開ツール、UCP 構造化レスポンスの返却方針を変更する箇所である。

```python
root_agent = Agent(
    name="shopper_agent",
    model="gemini-3-flash-preview",
    instruction=(
        "You are a helpful agent who can help user with shopping actions such"
        " as searching the catalog, add to checkout session, complete checkout"
        " and handle order placed event."
    ),
    tools=[
        search_shopping_catalog,
        add_to_checkout,
        remove_from_checkout,
        update_checkout,
        get_checkout,
        start_payment,
        update_customer_details,
        complete_checkout,
    ],
)
```

#### 商品・価格・送料・注文ロジック

- 対象ファイル: `business_agent/src/business_agent/store.py`
- 商品検索、line item 更新、送料・税計算、注文確定を変更する箇所である。

```python
def search_products(self, query: str) -> ProductResults:
    all_products = list(self._products.values())
    matching_products = {}

    keywords = query.lower().split()
    for keyword in keywords:
        for product in all_products:
            if product.product_id not in matching_products and (
                keyword in product.name.lower()
                or (product.category and keyword in product.category.lower())
            ):
                matching_products[product.product_id] = product
```

```python
if isinstance(checkout, FulfillmentCheckout) and checkout.fulfillment:
    tax = round(subtotal * 0.1)
    if selected_fulfillment_option:
        totals.append(
            Total(
                type="fulfillment",
                display_text="Shipping",
                amount=shipping,
            )
        )
        totals.append(Total(type="tax", display_text="Tax", amount=tax))
```

- 対象ファイル: `business_agent/src/business_agent/data/products.json`
- 商品カタログ自体を差し替える箇所であり、名称、価格、カテゴリ、画像 URL を調整できる。

```json
{
  "@type": "Product",
  "productID": "BISC-001",
  "name": "Chocochip Cookies",
  "image": ["http://localhost:10999/images/cookies.jpg"],
  "offers": {
    "price": "4.99",
    "priceCurrency": "USD"
  },
  "category": "Groceries > Snacks > Cookies & Biscuits"
}
```

#### 決済接続

- 対象ファイル: `business_agent/src/business_agent/payment_processor.py`
- モック決済を実際の決済サービス呼び出しへ置き換える入口である。

```python
def process_payment(
    self, payment_data: PaymentInstrument, risk_data: Any | None = None
) -> Task:
    task = Task(
        context_id="a unique context id",
        id="a unique task id",
        status=TaskStatus(state=TaskState.completed),
    )
    return task
```
