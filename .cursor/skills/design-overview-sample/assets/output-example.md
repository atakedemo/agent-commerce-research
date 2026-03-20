# 設計概要

このサンプルは、[対象システムの目的] を実現するための実装例である。

## 目的

このサンプルの主な目的は、[何を検証/実現するサンプルか] を示すことである。

## ディレクトリ構成

```
├── business_agent          #バックエンドで挙動する決済等を行うAIエージェント
│   ├── src
│   ├── README.md
│   └── pyproject.toml
├── chat-agent              #フロントエンド上のAIエージェント（チャットエージェント）
│   ├── components          #Webコンポーネント
│   ├── images
│   ├── mocks
│   ├── profile
│   ├── REAMDME.md
│   ├── App.tsx
│   ├── index.html
│   ├── index.tsx
│   ├── config.ts
│   ├── metadata.json
│   ├── types.ts
│   └── vite.config.ts
└── doc                     #設計書
    ├── design-overview.md  #設計概要
    ├── er.md               #ER図
    └── sequence.md         #シーケンス図
```

## システム構成

- [クライアント or フロントエンド]: [役割]
- [API or バックエンド]: [役割]

## 主要コンポーネント

### [コンポーネント名]
- 対応ファイル: `[path/to/file]`
- 責務: [このコンポーネントが担う責務]

## 主要データ

- `[エンティティ or データ名]`: [役割や保持内容]

## リクエスト/状態の流れ

1. [起点となる操作やイベント]
2. [主要コンポーネント] が [処理内容] を行う
3. [結果として返るレスポンスや最終状態]

## 制約と補足

- [モック実装、未実装部分、運用上の前提]

## カスタマイズを行う対象

### フロントエンド

#### 環境変数などの設定ファイル

例: `chat-agent/config.ts`

```json
{
  "apiBaseUrl": "http://localhost:3000",
  "agentProfileUrl": "/profile/agent_profile.json",
  "defaultMessage": "Hello, I am your Business Agent."
}
```

#### バックエンドとの疎通

例: `chat-agent/App.tsx`

```typescript
// 例: バックエンドAPIの接続先を決めている箇所
const response = await fetch("/api", {
  method: "POST",
  headers: defaultHeaders,
  body: JSON.stringify(payload),
});
```

#### [その他主要な処理]

例: `chat-agent/mocks/credentialProviderProxy.ts`

```typescript
// 例: 支払い手段の候補やトークン払い出しを差し替える箇所
async getPaymentToken(userEmail: string, paymentMethodId: string) {
  return {
    id: paymentMethodId,
    handler_id: "example_payment_provider",
    credential: {
      type: "token",
      token: "mock_token_xxx",
    },
  };
}
```

### バックエンド

#### 環境変数などの設定ファイル

例: `business_agent/.env` または `business_agent/src/business_agent/constants.py`

```bash
# 例: LLMや外部サービス接続に使う設定
GOOGLE_API_KEY=your-api-key
PORT=10999
LOG_LEVEL=info
```

#### エントリーポイント

例: `business_agent/src/business_agent/main.py`

```python
# 例: サーバー起動設定や公開ルートを変更する箇所
config = uvicorn.Config(app, host=host, port=port, log_level="info")
server = uvicorn.Server(config)
await server.serve()
```

#### 認可処理

例: `business_agent/src/business_agent/agent_executor.py`

```python
# 例: リクエストヘッダを検証し、許可するクライアント情報を解決する箇所
ucp_agent_header_key = next(
    (key for key in headers if key.lower() == UCP_AGENT_HEADER.lower()),
    None,
)
if not ucp_agent_header_key:
    raise ValueError("UCP-Agent should be present in request headers")
```

#### [その他主要な処理]

例: `business_agent/src/business_agent/store.py`

```python
# 例: 商品検索・チェックアウト更新・注文確定ロジックを差し替える箇所
def add_to_checkout(self, metadata, product_id: str, quantity: int, checkout_id=None):
    product = self.get_product(product_id)
    if not product:
        raise ValueError(f"Product with ID {product_id} is not found")
    # line_items や totals の更新処理
```

