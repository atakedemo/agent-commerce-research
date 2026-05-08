# c-ai-agent-app

`b-mcp-server` の UCP Shopping MCP ツールと AI エージェント（Gemini）を組み合わせた、エンドツーエンド疎通確認用のモックフロントエンドアプリ。

sequence.md が示すアクター構成（ユーザー → フロントエンド → バックエンド → MCP）のうち、フロントエンド〜バックエンド〜MCP の部分を担う。

---

## 前提条件

| 項目 | 要件 |
| --- | --- |
| Node.js | v18 以上 |
| b-mcp-server | `../b-mcp-server/` の依存インストール済み |
| GOOGLE_AI_STUDIO_API_KEY | AI チャット機能のみ必要（デモフローは不要） |

---

## セットアップ

```bash
# 1. b-mcp-server の依存インストール（未インストールの場合）
cd ../b-mcp-server
npm install

# 2. このアプリの依存インストール
cd ../c-ai-agent-app
npm install
```

---

## 実行方法

### CLI デモ（API キー不要）

b-mcp-server との疎通を端末上で直接確認する。Web サーバは起動しない。

```bash
npm run demo
```

実行例:

```
=== UCP Shopping Agent — 疎通確認デモ ===

b-mcp-server に接続中...
接続成功

✅ Step 1: 商品を検索  [search_catalog]
   商品数: 2件
✅ Step 2: 商品詳細を取得（Blue Running Shoes）  [get_product]
   商品名: Blue Running Shoes
✅ Step 3: カートを作成（item_123 を 1 点）  [create_cart]
   ID: cart_xxxx
   Status: active
   小計: 2500 USD
✅ Step 4: チェックアウトを開始  [create_checkout]
   Status: incomplete
✅ Step 5: 配送情報を入力  [update_checkout]
   Status: ready_for_complete
✅ Step 6: 注文を確定（デモ決済）  [complete_checkout]
   Status: completed

✅ 全ステップ成功 — 6 / 6 ステップ完了
```

---

### Web サーバ（デモフロー UI）

ブラウザでステップごとのレスポンスを確認できる。API キー不要。

```bash
npm start
```

起動後、<http://localhost:3100> にアクセスする。

「▶ デモを実行」ボタンを押すと全 6 ステップが順に実行され、各 MCP ツールのレスポンス JSON が表示される。

---

### Web サーバ（AI チャット機能付き）

Gemini が MCP ツールを自律的に呼び出してショッピングを代行する。`GOOGLE_AI_STUDIO_API_KEY` が必要。

```bash
GOOGLE_AI_STUDIO_API_KEY=AIza... npm start
```

起動後、<http://localhost:3100> の「AI チャット」タブから操作できる。

入力例:

- `ランニングシューズを検索して`
- `Blue Running Shoes の詳細を教えて`
- `カートを作って item_123 を 1 つ追加して、チェックアウトまで完了させて`

---

## アプリ構成

```
c-ai-agent-app/
├── package.json
├── src/
│   ├── mcp-client.js     # b-mcp-server を stdio 起動し callTool() を提供
│   ├── shopping-flow.js  # 6 ステップの全工程を順に実行し構造化結果を返す
│   ├── demo.js           # CLI 疎通確認スクリプト（npm run demo）
│   └── server.js         # Express HTTP サーバ（npm start）
└── public/
    └── index.html        # SPA（デモフロー UI + AI チャット UI）
```

---

## API エンドポイント（server.js）

| メソッド | パス | 説明 |
| --- | --- | --- |
| `GET` | `/` | SPA（index.html）を配信 |
| `GET` | `/api/status` | `{ "gemini": true/false }` を返す |
| `POST` | `/api/demo` | 全 6 ステップを実行し `{ ok, steps[] }` を返す |
| `POST` | `/api/chat` | Gemini + MCP agentic loop。`GOOGLE_AI_STUDIO_API_KEY` 必須 |

### POST /api/demo — リクエスト / レスポンス例

```bash
curl -X POST http://localhost:3100/api/demo
```

```json
{
  "ok": true,
  "steps": [
    { "name": "商品を検索", "tool": "search_catalog", "ok": true, "data": { ... } },
    { "name": "商品詳細を取得（Blue Running Shoes）", "tool": "get_product", "ok": true, "data": { ... } },
    ...
  ]
}
```

### POST /api/chat — リクエスト / レスポンス例

```bash
curl -X POST http://localhost:3100/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "ランニングシューズを探して", "history": []}'
```

```json
{
  "ok": true,
  "text": "ランニングシューズが 2 件見つかりました。...",
  "toolCallLog": [
    { "tool": "search_catalog", "isError": false }
  ],
  "history": [ ... ]
}
```

`history` フィールドに返却された会話履歴を次のリクエストの `history` に渡すことで、複数ターンの会話を継続できる。

---

## 実行される MCP ツール（デモフロー）

| ステップ | ツール | 概要 |
| --- | --- | --- |
| 1 | `search_catalog` | "running shoes" でキーワード検索 |
| 2 | `get_product` | 検索結果の先頭商品の詳細・バリアントを取得 |
| 3 | `create_cart` | item_123 を 1 点入れたカートを作成 |
| 4 | `create_checkout` | カートからチェックアウトセッションを開始 |
| 5 | `update_checkout` | 配送先住所とメールアドレスを入力 |
| 6 | `complete_checkout` | デモ決済参照番号を付けて注文を確定 |

---

## 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `GOOGLE_AI_STUDIO_API_KEY` | チャット機能のみ | Google AI Studio API キー（`AIza...`） |
| `PORT` | 任意 | HTTP サーバのポート番号（デフォルト: `3100`） |
| `EC_BACKEND_URL` | 任意 | Medusa バックエンド URL（設定時は `create_checkout` が Store API を呼ぶ） |
| `EC_PUBLISHABLE_KEY` | 任意 | Medusa の Publishable API Key（`pk_...`） |
