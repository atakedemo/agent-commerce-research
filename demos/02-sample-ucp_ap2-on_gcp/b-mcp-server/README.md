# b-mcp-server

UCP Shopping MCP ツール（全 12 ツール）を提供するモック MCP サーバ。
`@modelcontextprotocol/sdk` の stdio トランスポートで動作し、カタログ・カート・チェックアウトをインメモリで管理する。

---

## 前提条件

| 項目 | 要件 |
| --- | --- |
| Node.js | v18 以上 |

---

## セットアップ

```bash
cd demos/01-sample-ucp_ap2/b-mcp-server
npm install
```

---

## 起動手順

### 注意: stdio サーバについて

このサーバは **stdio トランスポート** で動作する MCP サーバのため、ターミナルから単独で `npm start` しても端末に何も表示されず待機状態になる。サーバは MCP クライアント（c-ai-agent-app・MCP Inspector 等）がサブプロセスとして起動したときに自動的に接続される設計である。

### 方法 1: c-ai-agent-app から自動起動（通常の使い方）

c-ai-agent-app のデモフローや AI チャットを実行すると、このサーバが自動的にサブプロセスとして起動・終了する。ユーザが直接このサーバを起動する必要はない。

```bash
# c-ai-agent-app ディレクトリで実行
cd ../c-ai-agent-app
npm run demo        # CLI デモ（b-mcp-server を内部で自動起動）
npm start           # Web サーバ起動（デモフロー UI + AI チャット）
```

### 方法 2: MCP Inspector でインタラクティブに起動

[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) を使うと、ブラウザ UI からツールを個別に呼び出してレスポンスを確認できる。

```bash
npx @modelcontextprotocol/inspector node src/server.js
```

起動後、ターミナルに表示される URL（例: `http://localhost:6274`）にブラウザでアクセスする。左ペインから任意のツールを選択し、JSON 形式で引数を入力して「Run Tool」を押すと結果が表示される。

### 方法 3: 環境変数を指定して起動

Medusa EC バックエンドと連携させる場合（`create_checkout` 時に Medusa Store API を呼び出す）は下記の環境変数を設定する。

```bash
EC_BACKEND_URL=http://localhost:9000 \
EC_PUBLISHABLE_KEY=pk_... \
node src/server.js
```

---

## テストの実施方法

### 方法 1: 適合性テストスイート（推奨）

`../test/` ディレクトリに全 12 ツールに対する MCP 適合性テスト（45 テスト）が用意されている。

```bash
# セットアップ（初回のみ）
cd ../test
npm install

# 全テストを一括実行
npm test

# ツール種別ごとに実行
npm run test:checkout   # create / get / update / complete / cancel_checkout（21 テスト）
npm run test:catalog    # search_catalog / get_product / lookup_catalog（12 テスト）
npm run test:cart       # create_cart / get_cart / update_cart / cancel_cart（12 テスト）
```

テストは `node --test` ランナーを使用し、サーバを stdio サブプロセスとして起動して MCP JSON-RPC でツールを呼び出す。詳細は [`../test/README.md`](../test/README.md) を参照。

**現在の合格状況: 45 tests / 0 fail / 0 skip**

### 方法 2: CLI デモによる疎通確認

`c-ai-agent-app` の CLI デモを使って全 6 ステップの購買フローを端末上で確認する。

```bash
cd ../c-ai-agent-app
npm run demo
```

期待する出力:

```
=== UCP Shopping Agent — 疎通確認デモ ===

b-mcp-server に接続中...
接続成功

✅ Step 1: 商品を検索  [search_catalog]
✅ Step 2: 商品詳細を取得（Blue Running Shoes）  [get_product]
✅ Step 3: カートを作成（item_123 を 1 点）  [create_cart]
✅ Step 4: チェックアウトを開始  [create_checkout]
✅ Step 5: 配送情報を入力  [update_checkout]
✅ Step 6: 注文を確定（デモ決済）  [complete_checkout]

✅ 全ステップ成功 — 6 / 6 ステップ完了
```

### 方法 3: MCP Inspector で手動確認

各ツールを個別に呼び出して JSON レスポンスを目視確認する場合は MCP Inspector を使用する（[起動手順を参照](#方法-2-mcp-inspector-でインタラクティブに起動)）。

**`search_catalog` の呼び出し例:**

```json
{
  "meta": {
    "ucp-agent": { "profile": "https://demo-agent.example/.well-known/ucp" }
  },
  "catalog": {
    "query": "running shoes",
    "pagination": { "limit": 5 }
  }
}
```

**`complete_checkout` の呼び出し例（`idempotency-key` 必須）:**

```json
{
  "meta": {
    "ucp-agent": { "profile": "https://demo-agent.example/.well-known/ucp" },
    "idempotency-key": "550e8400-e29b-41d4-a716-446655440000"
  },
  "id": "co_xxxxxx",
  "checkout": { "payment_reference": "demo_payment_ok" }
}
```

---

## 実装ツール一覧

| グループ | ツール名 | UCP 仕様 §番号 | 概要 |
| --- | --- | --- | --- |
| カタログ | `search_catalog` | §3 | キーワード・カテゴリ・価格・ページネーションで商品検索 |
| カタログ | `get_product` | §4 | 商品 ID で詳細・バリアント取得。選択オプションでフィルタ可 |
| カタログ | `lookup_catalog` | §5 | 複数商品 ID を一括解決 |
| カート | `create_cart` | §6 | line_items を指定してカートを作成 |
| カート | `get_cart` | §7 | カート ID でスナップショット取得 |
| カート | `update_cart` | §8 | line_items を全体置換（マージではなく上書き） |
| カート | `cancel_cart` | §8 | アクティブなカートをキャンセル |
| チェックアウト | `create_checkout` | §9 | チェックアウトセッションを開始（status: incomplete） |
| チェックアウト | `get_checkout` | §10 | チェックアウト ID で現在の状態を取得 |
| チェックアウト | `update_checkout` | §11 | 配送情報・メール等をマージ更新（status: ready_for_complete） |
| チェックアウト | `complete_checkout` | §12 | 注文を確定（status: completed）。`idempotency-key` 必須 |
| チェックアウト | `cancel_checkout` | §13 | チェックアウトをキャンセル（status: canceled）。`idempotency-key` 必須 |

---

## チェックアウトの状態遷移

```
incomplete
    │
    ├─ update_checkout ──→ ready_for_complete
    │                              │
    │                    complete_checkout ──→ completed（終端）
    │
    └─ cancel_checkout ──→ canceled（終端）
```

- `complete_checkout` / `cancel_checkout` は `meta` に `idempotency-key`（UUID）が必須
- `canceled` 状態への `update_checkout` / `complete_checkout` はエラーを返す
- `completed` 状態への `cancel_checkout` はエラーを返す

---

## 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `EC_BACKEND_URL` | 任意 | Medusa バックエンド URL（設定時は `create_checkout` が Store API を呼ぶ） |
| `EC_PUBLISHABLE_KEY` | 任意 | Medusa の Publishable API Key（`pk_...`） |

両変数が未設定の場合は `create_checkout` がインメモリのみで動作する（デフォルト）。

---

## アーキテクチャメモ

- **トランスポート**: stdio（HTTP ではない）— MCP クライアントがサブプロセスとして起動する
- **データ永続性**: インメモリ — サーバプロセス終了で全データがリセットされる
- **スキーマ検証**: `zod` で全ツールの入力を検証。`meta.ucp-agent.profile` は全ツール必須
- **モックカタログ**: `Blue Running Shoes`・`Red Style Shirt`・`White Running Shoes` の 3 商品が初期データ
