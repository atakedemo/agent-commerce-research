# demos/01-sample-ucp_ap2

UCP（Universal Commerce Protocol）+ AP2（Agentic Payment Protocol）のデモ環境。

## コンポーネント一覧

| ディレクトリ | 役割 | ポート |
|---|---|---|
| `a-sandbox-ec/` | EC バックエンド（Medusa v2）+ ストアフロント（Next.js 15） | `:9000` / `:8000` |
| `b-mcp-server/` | UCP Shopping MCP サーバ（stdio、`c-ai-agent-app` が自動起動） | stdio |
| `c-ai-agent-app/` | AI エージェントアプリ（デモフロー UI + Gemini AI チャット） | `:3100` |
| `d-payment_handler-credential_provider/` | UCP Payment Handler + AP2 Credential Provider | `:3200` |
| `e-trusted_surface-wallet/` | AP2 Trusted Surface（Open Mandate 発行・JWKS 公開） | `:3300` |

---

## 構成パターン

目的に応じて起動するコンポーネントを選択してください。

| パターン | 使用コンポーネント |
|---|---|
| **A. 最小構成**（UCP 疎通確認のみ） | `c-ai-agent-app` + `b-mcp-server`（自動） |
| **B. 従来フロー**（Payment Handler 連携） | A + `d-payment_handler-credential_provider` |
| **C. AP2 HNP フロー**（全 AP2 コンポーネント） | B + `e-trusted_surface-wallet` |
| **D. 完全構成**（実 EC バックエンド連携） | C + `a-sandbox-ec` |

---

## パターン A — 最小構成（UCP 疎通確認）

`b-mcp-server` は `c-ai-agent-app` がサブプロセスとして自動起動します。個別に起動する必要はありません。

### セットアップ

```bash
# b-mcp-server の依存インストール（初回のみ）
cd demos/01-sample-ucp_ap2/b-mcp-server
npm install

# c-ai-agent-app の依存インストール（初回のみ）
cd ../c-ai-agent-app
npm install
```

### 起動

```bash
cd demos/01-sample-ucp_ap2/c-ai-agent-app
npm start
```

`http://localhost:3100` でアプリが起動します。  
「▶ デモを実行」ボタンで 6 ステップの UCP ショッピングフローを確認できます。

### AI チャット機能を使う場合

```bash
GOOGLE_AI_STUDIO_API_KEY=AIza... npm start
```

または `.env` ファイルに設定：

```
# c-ai-agent-app/.env
GOOGLE_AI_STUDIO_API_KEY=AIza...
```

---

## パターン B — 従来フロー（Payment Handler 連携）

Payment Handler を追加することで、チェックアウト時に UCP トークン発行フローが有効になります。

### セットアップ

```bash
# d-payment_handler-credential_provider の依存インストール（初回のみ）
cd demos/01-sample-ucp_ap2/d-payment_handler-credential_provider
npm install
```

### 起動順序

**ターミナル 1** — Payment Handler

```bash
cd demos/01-sample-ucp_ap2/d-payment_handler-credential_provider
node src/server.js
# → http://localhost:3200 で起動（Stripe 未設定はモックモード）
```

**ターミナル 2** — AI エージェントアプリ

```bash
cd demos/01-sample-ucp_ap2/c-ai-agent-app
npm start
# → http://localhost:3100 で起動
```

### 環境変数（`c-ai-agent-app/.env`）

```
PAYMENT_HANDLER_URL=http://localhost:3200
```

---

## パターン C — AP2 HNP フロー（全 AP2 コンポーネント）

Trusted Surface が Open Mandate を発行し、Credential Provider が署名を検証する完全な AP2 HNP フローです。

### セットアップ

```bash
# e-trusted_surface-wallet の依存インストール（初回のみ）
cd demos/01-sample-ucp_ap2/e-trusted_surface-wallet
npm install
```

### 起動順序

**ターミナル 1** — Trusted Surface（Wallet）

```bash
cd demos/01-sample-ucp_ap2/e-trusted_surface-wallet
node src/server.js
# → http://localhost:3300 で起動
```

**ターミナル 2** — Payment Handler + Credential Provider

```bash
cd demos/01-sample-ucp_ap2/d-payment_handler-credential_provider
TRUSTED_SURFACE_URL=http://localhost:3300 node src/server.js
# → http://localhost:3200 で起動（Trusted Surface の JWKS で Mandate 検証）
```

**ターミナル 3** — AI エージェントアプリ

```bash
cd demos/01-sample-ucp_ap2/c-ai-agent-app
npm start
# → http://localhost:3100 で起動
```

---

## パターン D — 完全構成（実 EC バックエンド連携）

Medusa v2 バックエンドと Next.js ストアフロントを追加します。PostgreSQL と Redis が必要です。

### 前提条件

- PostgreSQL v15 以上
- Redis v7 以上

```bash
# macOS（Homebrew）
brew services start postgresql@15
brew services start redis
```

### セットアップ

```bash
# a-sandbox-ec の依存インストール（初回のみ）
cd demos/01-sample-ucp_ap2/a-sandbox-ec
npm install
```

環境変数を設定してください（詳細は `a-sandbox-ec/README.md` 参照）：

```bash
# a-sandbox-ec/apps/backend/.env
DATABASE_URL=postgres://<OSユーザー名>@localhost/medusa-a-sandbox-ec-2
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
```

```bash
# 初回のみ: DB マイグレーション
cd demos/01-sample-ucp_ap2/a-sandbox-ec/apps/backend
npm run build && npx medusa db:migrate
```

### 起動順序

**ターミナル 1** — Medusa バックエンド + Next.js ストアフロント

```bash
cd demos/01-sample-ucp_ap2/a-sandbox-ec
npm run dev
# バックエンド: http://localhost:9000
# ストアフロント: http://localhost:8000
```

**ターミナル 2** — Trusted Surface（AP2 HNP を使う場合）

```bash
cd demos/01-sample-ucp_ap2/e-trusted_surface-wallet
node src/server.js
```

**ターミナル 3** — Payment Handler + Credential Provider

```bash
cd demos/01-sample-ucp_ap2/d-payment_handler-credential_provider
TRUSTED_SURFACE_URL=http://localhost:3300 node src/server.js
```

**ターミナル 4** — AI エージェントアプリ

```bash
cd demos/01-sample-ucp_ap2/c-ai-agent-app
npm start
```

### 環境変数（`c-ai-agent-app/.env` / `b-mcp-server/.env`）

```
EC_BACKEND_URL=http://localhost:9000
EC_PUBLISHABLE_KEY=<Admin から取得した pk_...>
PAYMENT_HANDLER_URL=http://localhost:3200
```

Publishable API Key の取得: `http://localhost:9000/app` → Settings → Publishable API Keys

---

## ポート一覧

| サービス | URL | 備考 |
|---|---|---|
| Medusa バックエンド | `http://localhost:9000` | `a-sandbox-ec` |
| Medusa Admin | `http://localhost:9000/app` | `a-sandbox-ec` |
| ストアフロント | `http://localhost:8000` | `a-sandbox-ec` |
| AI エージェントアプリ | `http://localhost:3100` | `c-ai-agent-app` |
| Payment Handler / Credential Provider | `http://localhost:3200` | `d-payment_handler-credential_provider` |
| Trusted Surface (Wallet) | `http://localhost:3300` | `e-trusted_surface-wallet` |

---

## 環境変数まとめ

### `c-ai-agent-app/.env`

| 変数 | 必須 | 説明 |
|---|---|---|
| `GOOGLE_AI_STUDIO_API_KEY` | AI チャット時のみ | Google AI Studio API キー |
| `PAYMENT_HANDLER_URL` | Payment Handler 連携時 | デフォルト: `http://localhost:3200` |
| `EC_BACKEND_URL` | EC バックエンド連携時 | デフォルト: `http://localhost:9000` |
| `EC_PUBLISHABLE_KEY` | EC バックエンド連携時 | Medusa Publishable API Key |

### `b-mcp-server/.env`

| 変数 | 必須 | 説明 |
|---|---|---|
| `EC_BACKEND_URL` | EC バックエンド連携時 | デフォルト: `http://localhost:9000` |
| `EC_PUBLISHABLE_KEY` | EC バックエンド連携時 | Medusa Publishable API Key |
| `PAYMENT_HANDLER_URL` | Payment Handler 連携時 | デフォルト: `http://localhost:3200` |

### `d-payment_handler-credential_provider`（環境変数）

| 変数 | 必須 | 説明 |
|---|---|---|
| `TRUSTED_SURFACE_URL` | AP2 HNP 時のみ | 省略時はモックモード（署名検証スキップ） |
| `STRIPE_SECRET_KEY` | 実決済時のみ | 省略時はモックモード |
| `PAYMENT_HANDLER_PORT` | 任意 | デフォルト: `3200` |

### `e-trusted_surface-wallet`（環境変数）

| 変数 | 必須 | 説明 |
|---|---|---|
| `TRUSTED_SURFACE_PORT` | 任意 | デフォルト: `3300` |
| `TRUSTED_SURFACE_API_KEY` | 任意 | 認証キー（未設定時は認証なし） |

---

## ドキュメント

設計・仕様の詳細は `zz-docs/` を参照してください。

| ファイル | 内容 |
|---|---|
| `zz-docs/design-overview.md` | アーキテクチャ概要・コンポーネント構成 |
| `zz-docs/sequence.md` | シーケンス図（UCP 従来フロー + AP2 HNP フロー） |
| `zz-docs/mcp-reference.md` | MCP ツール一覧・リクエスト/レスポンス仕様 |
| `zz-docs/api-reference.md` | HTTP API 一覧 |
