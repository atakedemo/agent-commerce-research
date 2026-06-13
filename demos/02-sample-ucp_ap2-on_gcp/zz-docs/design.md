# GCPデプロイ設計書

## 1. 概要

`demos/01-sample-ucp_ap2` の各コンポーネントをGCP上へデプロイするための設計書。
インフラはTerraformによりIaC管理する。

### 対象コンポーネント

| コンポーネント | ディレクトリ | 概要 |
|---|---|---|
| EC一式 | `a-sandbox-ec` | Medusa v2バックエンド + Next.js 15ストアフロント |
| MCPサーバー | `b-mcp-server` | UCP Shopping MCP Server（stdio transport） |
| AIエージェント | `c-ai-agent-app` | Express.js + Gemini AI エージェントUI |
| Payment Handler / Credential Provider | `d-payment_handler-credential_provider` | UCP Payment Handler + AP2 Credential Provider |

> `e-trusted_surface-mock_wallet` はデモ用途のモックサーバーであり、同様にデプロイ対象に含める。

---

## 2. アーキテクチャ概要

```
                         ┌─────────────────────────────────────────────────────┐
                         │                     GCP Project                     │
                         │                                                     │
  User / AI Agent        │  ┌──────────────────┐    ┌───────────────────────┐  │
  ─────────────          │  │  Cloud Run       │    │  Cloud Run            │  │
       │                 │  │  c-ai-agent-app  │───▶│  b-mcp-server         │  │
       ▼                 │  │  (Port 3100)     │    │  (HTTP wrapper)       │  │
  Cloud Load Balancing   │  └────────┬─────────┘    └───────────────────────┘  │
       │                 │           │                                          │
       ├────────────────▶│  ┌────────▼─────────┐    ┌───────────────────────┐  │
       │                 │  │  Cloud Run       │    │  Cloud Run            │  │
       │                 │  │  d-payment_      │    │  e-trusted_surface    │  │
       │                 │  │  handler         │◀───│  (Port 3300)          │  │
       │                 │  │  (Port 3200)     │    └───────────────────────┘  │
       │                 │  └────────┬─────────┘                               │
       │                 │           │                                          │
       └────────────────▶│  ┌────────▼─────────────────────────────────────┐  │
                         │  │  Cloud Run: a-sandbox-ec                     │  │
                         │  │  ┌──────────────────┐  ┌──────────────────┐  │  │
                         │  │  │  Medusa Backend  │  │  Next.js Store   │  │  │
                         │  │  │  (Port 9000)     │  │  (Port 8000)     │  │  │
                         │  │  └────────┬─────────┘  └──────────────────┘  │  │
                         │  └──────────┼──────────────────────────────────-─┘  │
                         │             │                                        │
                         │  ┌──────────▼──────────┐  ┌────────────────────┐   │
                         │  │  Cloud SQL          │  │  Memorystore       │   │
                         │  │  PostgreSQL 15      │  │  Redis 7           │   │
                         │  └─────────────────────┘  └────────────────────┘   │
                         │                                                     │
                         │  ┌──────────────────────────────────────────────┐  │
                         │  │  Artifact Registry  │  Secret Manager        │  │
                         │  └──────────────────────────────────────────────┘  │
                         └─────────────────────────────────────────────────────┘
```

---

## 3. GCPリソース設計

### 3.1 Cloud Run サービス一覧

| サービス名 | ソース | ポート | CPU | メモリ | 最小インスタンス | 公開 |
|---|---|---|---|---|---|---|
| `ec-backend` | `a-sandbox-ec/apps/backend` | 9000 | 1 | 1Gi | 1 | 内部 + LB |
| `ec-storefront` | `a-sandbox-ec/apps/storefront` | 8000 | 1 | 512Mi | 1 | 公開 |
| `mcp-server` | `b-mcp-server` | 3000 | 0.5 | 256Mi | 0 | 内部のみ |
| `ai-agent-app` | `c-ai-agent-app` | 3100 | 1 | 512Mi | 1 | 公開 |
| `payment-handler` | `d-payment_handler-credential_provider` | 3200 | 0.5 | 256Mi | 0 | 内部のみ |
| `trusted-surface` | `e-trusted_surface-mock_wallet` | 3300 | 0.5 | 256Mi | 0 | 内部のみ |

> `mcp-server` は元々 stdio transport だが、GCPデプロイにあたりHTTP transport（SSE or Streamable HTTP）に変換するラッパーを実装する（詳細は §5 参照）。

### 3.2 Cloud SQL

| 項目 | 値 |
|---|---|
| データベースエンジン | PostgreSQL 15 |
| インスタンスタイプ | `db-g1-small`（開発）/ `db-custom-2-7680`（本番） |
| ストレージ | 20GB SSD（自動拡張有効） |
| 接続方式 | Cloud SQL Auth Proxy（サービスアカウント認証） |
| バックアップ | 日次自動バックアップ（保持7日） |
| データベース名 | `medusa_ec` |

### 3.3 Memorystore for Redis

| 項目 | 値 |
|---|---|
| バージョン | Redis 7.x |
| ティア | Basic（開発）/ Standard（本番） |
| メモリ容量 | 1GB |
| 接続方式 | VPC内プライベートIP |

### 3.4 Artifact Registry

| 項目 | 値 |
|---|---|
| リポジトリ名 | `ucp-ap2-demo` |
| リージョン | `asia-northeast1`（東京） |
| フォーマット | Docker |

### 3.5 Secret Manager

以下のシークレットを管理する：

| シークレット名 | 対応コンポーネント | 内容 |
|---|---|---|
| `medusa-jwt-secret` | ec-backend | Medusa JWT秘密鍵 |
| `medusa-cookie-secret` | ec-backend | Medusa Cookie秘密鍵 |
| `medusa-publishable-key` | b-mcp-server, c-ai-agent-app | Medusa Publishable APIキー |
| `stripe-api-key` | ec-backend | Stripe APIキー（バックエンド） |
| `stripe-webhook-secret` | ec-backend | Stripe Webhookシークレット |
| `stripe-secret-key` | payment-handler | Stripe秘密鍵（Payment Handler） |
| `google-ai-studio-api-key` | ai-agent-app | Gemini AI APIキー |
| `google-client-id` | ai-agent-app, payment-handler | Google OAuth クライアントID |

---

## 4. ネットワーク設計

### 4.1 VPC構成

```
VPC: ucp-ap2-demo-vpc
  ├── Subnet: ucp-ap2-demo-subnet (10.0.0.0/24) - asia-northeast1
  │   ├── Cloud Run サービス（VPC Connector 経由）
  │   ├── Cloud SQL（プライベートIP）
  │   └── Memorystore Redis（プライベートIP）
  └── Serverless VPC Access Connector: ucp-ap2-connector
```

### 4.2 外部アクセス

| エンドポイント | Cloud Run サービス | 認証 |
|---|---|---|
| `https://ec.example.com` | ec-storefront | なし（公開） |
| `https://api.ec.example.com` | ec-backend | なし（Medusa APIキー認証） |
| `https://agent.example.com` | ai-agent-app | なし（公開） |

内部サービス（`mcp-server`, `payment-handler`, `trusted-surface`）は Cloud Run の内部エンドポイントのみ公開し、外部からの直接アクセスは不可とする。

### 4.3 サービス間通信

| 呼び出し元 | 呼び出し先 | 通信方式 |
|---|---|---|
| ai-agent-app | mcp-server | Cloud Run 内部URL（HTTPS）|
| ai-agent-app | payment-handler | Cloud Run 内部URL（HTTPS）|
| mcp-server | ec-backend | Cloud Run 内部URL（HTTPS）|
| payment-handler | trusted-surface | Cloud Run 内部URL（HTTPS）|
| payment-handler | ec-backend | Cloud Run 内部URL（HTTPS）|
| ec-backend | Cloud SQL | Cloud SQL Auth Proxy（VPC）|
| ec-backend | Memorystore | VPC プライベートIP |

---

## 5. コンテナ設計

### 5.1 a-sandbox-ec / backend

```dockerfile
# ベースイメージ: node:20-slim
# ビルドステージ: npm install --production, npm run build
# 実行ステージ: node src/index.js
# ポート: 9000
# ヘルスチェック: GET /health
```

**Cloud SQL接続:** Cloud Run の `--add-cloudsql-instances` フラグ + `DATABASE_URL` に Unix ソケットパス（`/cloudsql/<instance>`) を指定。

### 5.2 a-sandbox-ec / storefront

```dockerfile
# ベースイメージ: node:20-slim
# ビルドステージ: npm run build (next build)
# 実行ステージ: node .next/standalone/server.js
# ポート: 8000
# ヘルスチェック: GET /
```

ビルド時に `NEXT_PUBLIC_MEDUSA_BACKEND_URL` 等の環境変数が埋め込まれるため、ビルド引数（`ARG`）として渡す。

### 5.3 b-mcp-server（HTTP transport ラッパー）

元の実装は stdio transport だが、Cloud Runでは HTTP サーバーとして動作させる必要がある。
`@modelcontextprotocol/sdk` の `StreamableHTTPServerTransport` を使用したHTTPラッパーを追加する。

```
b-mcp-server/
├── src/
│   ├── server.js      (既存: MCP Server実装)
│   ├── medusa.js      (既存: Medusa API連携)
│   └── http-server.js (新規: HTTP transport ラッパー)
```

```dockerfile
# ベースイメージ: node:20-slim
# エントリーポイント: node src/http-server.js
# ポート: 3000
# ヘルスチェック: GET /health
```

### 5.4 c-ai-agent-app

```dockerfile
# ベースイメージ: node:20-slim
# エントリーポイント: node src/server.js
# ポート: 3100
# ヘルスチェック: GET /health
```

MCP Client の接続先を stdio (subprocess) から HTTP（`b-mcp-server` Cloud Run内部URL）に変更する。

### 5.5 d-payment_handler-credential_provider

```dockerfile
# ベースイメージ: node:20-slim
# エントリーポイント: node src/server.js
# ポート: 3200
# ヘルスチェック: GET /health
```

### 5.6 e-trusted_surface-mock_wallet

```dockerfile
# ベースイメージ: node:20-slim
# エントリーポイント: node src/server.js
# ポート: 3300
# ヘルスチェック: GET /health
```

---

## 6. セキュリティ設計

### 6.1 サービスアカウント

各Cloud Runサービスに専用のサービスアカウントを付与する。

| サービスアカウント | 付与ロール | 用途 |
|---|---|---|
| `sa-ec-backend` | `cloudsql.client`, `secretmanager.secretAccessor` | Cloud SQL接続、シークレット参照 |
| `sa-ec-storefront` | `secretmanager.secretAccessor` | シークレット参照 |
| `sa-mcp-server` | `secretmanager.secretAccessor`, `run.invoker` | シークレット参照、ec-backend呼び出し |
| `sa-ai-agent-app` | `secretmanager.secretAccessor`, `run.invoker` | シークレット参照、内部サービス呼び出し |
| `sa-payment-handler` | `secretmanager.secretAccessor`, `run.invoker` | シークレット参照、内部サービス呼び出し |
| `sa-trusted-surface` | `secretmanager.secretAccessor` | シークレット参照 |

### 6.2 内部サービスへのアクセス制御

内部公開のCloud Runサービス（mcp-server, payment-handler, trusted-surface）は `--ingress internal-and-cloud-load-balancing` を設定し、外部から直接アクセス不可にする。
各サービス間の呼び出しはサービスアカウントの `run.invoker` ロールにより認証する。

### 6.3 シークレット管理

- 全ての機密情報はSecret Managerで管理し、環境変数への直接記載は禁止
- TerraformのCloud Run定義でシークレットを環境変数にマウント（`secret_environment_variables`ブロック）
- Terraformのstateファイルにシークレット値を含めないようにする（`sensitive = true`指定）

---

## 7. Terraform構成

### 7.1 ディレクトリ構造

```
demos/02-sample-ucp_ap2-on_gcp/
├── docs/
│   └── design.md                        # 本設計書
├── terraform/
│   ├── provider.tf                      # Google Providerの設定
│   ├── variables.tf                     # 入力変数定義
│   ├── outputs.tf                       # 出力値定義
│   ├── main.tf                          # モジュール呼び出しのエントリーポイント
│   ├── locals.tf                        # ローカル変数（命名規則等）
│   ├── modules/
│   │   ├── networking/                  # VPC, Subnet, VPC Connector
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── cloud-sql/                   # Cloud SQL（PostgreSQL）
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── memorystore/                 # Memorystore Redis
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── artifact-registry/           # Artifact Registry
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── secret-manager/              # Secret Manager シークレット定義
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── service-accounts/            # サービスアカウントとIAMバインディング
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   └── cloud-run/                   # Cloud Runサービス（各サービス共通モジュール）
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       └── outputs.tf
│   └── environments/
│       └── dev/
│           ├── main.tf                  # 開発環境用モジュール呼び出し
│           ├── variables.tf
│           ├── terraform.tfvars.example # 変数設定例（機密値はplaceholder）
│           └── backend.tf               # Terraform state (GCS)
├── a-sandbox-ec/                        # デプロイ用にコピーしたソースコード
│   └── apps/
│       ├── backend/
│       │   └── Dockerfile
│       └── storefront/
│           └── Dockerfile
├── b-mcp-server/
│   └── Dockerfile
├── c-ai-agent-app/
│   └── Dockerfile
├── d-payment_handler-credential_provider/
│   └── Dockerfile
└── e-trusted_surface-mock_wallet/
    └── Dockerfile
```

### 7.2 主要Terraform変数

| 変数名 | 型 | 説明 | デフォルト |
|---|---|---|---|
| `project_id` | string | GCPプロジェクトID | — |
| `region` | string | デプロイリージョン | `asia-northeast1` |
| `environment` | string | 環境名（dev/prod） | `dev` |
| `domain_ec_storefront` | string | ストアフロントドメイン | — |
| `domain_ec_backend` | string | バックエンドAPIドメイン | — |
| `domain_ai_agent` | string | AIエージェントUIドメイン | — |

---

## 8. コードの変更点

GCPデプロイにあたり、以下のソースコードの変更が必要。

### 8.1 b-mcp-server: HTTP transport の追加

**新規ファイル `src/http-server.js`:**

```javascript
// stdio transport の代わりに StreamableHTTPServerTransport を使用して
// Cloud Run 上で HTTP サーバーとして動作させる
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';
// 既存の server.js の MCP Server インスタンスを受け取り、HTTP でサーブする
```

### 8.2 c-ai-agent-app: MCP クライアントのトランスポート切り替え

`src/mcp-client.js` にて、環境変数 `MCP_SERVER_URL` が設定されている場合は `StreamableHTTPClientTransport`、未設定の場合は従来の `StdioClientTransport`（サブプロセス起動）にフォールバックするよう修正する。

```javascript
// MCP_SERVER_URL が設定されている場合: HTTP transport（Cloud Run用）
// MCP_SERVER_URL が未設定の場合: stdio transport（ローカル開発用）
```

### 8.3 各サービス: ヘルスチェックエンドポイントの追加

Cloud Runのヘルスチェックに対応するため、未実装のサービスに `GET /health` エンドポイントを追加する。

| サービス | 現状 | 対応 |
|---|---|---|
| ec-backend | Medusa 組み込みあり | 確認・利用 |
| ec-storefront | Next.js 組み込みあり | 確認・利用 |
| mcp-server（HTTP化後） | なし | 追加 |
| ai-agent-app | 要確認 | 必要に応じて追加 |
| payment-handler | あり（`GET /health`） | そのまま利用 |
| trusted-surface | あり（`GET /health`） | そのまま利用 |

---

## 9. デプロイ手順（概要）

```bash
# 1. Artifact Registry へイメージをビルド & プッシュ
cd demos/02-sample-ucp_ap2-on_gcp
gcloud builds submit --config cloudbuild.yaml

# 2. Terraform 初期化
cd terraform/environments/dev
terraform init

# 3. シークレット値を設定（初回のみ）
gcloud secrets versions add medusa-jwt-secret --data-file=<(echo -n "YOUR_JWT_SECRET")
# ... 他のシークレットも同様

# 4. インフラをデプロイ
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars

# 5. Medusa DB マイグレーション実行（初回のみ）
gcloud run jobs execute ec-backend-migration --region=asia-northeast1

# 6. Medusa シードデータ投入（初回のみ）
gcloud run jobs execute ec-backend-seed --region=asia-northeast1
```

---

## 10. 課題・リスク

| # | 課題 | 優先度 | 対応方針 |
|---|---|---|---|
| 1 | `b-mcp-server` の stdio → HTTP transport 変換が必要 | 高 | `http-server.js` を新規作成し、既存の `server.js` を変更せずラップ |
| 2 | `c-ai-agent-app` の MCP クライアントが stdio を前提としている | 高 | 環境変数によるトランスポート切り替えを実装 |
| 3 | Next.js ビルド時に `NEXT_PUBLIC_*` 環境変数の埋め込みが必要 | 中 | Cloud Buildのビルド引数として渡すか、ランタイム設定方式（rewrites等）を採用 |
| 4 | Cloud SQL Auth Proxy の設定（Cloud Runとの連携） | 中 | Cloud Run の `--add-cloudsql-instances` と Unix ソケット接続で対応 |
| 5 | `e-trusted_surface-mock_wallet` はモックウォレットのため本番用途には不向き | 低 | デモ用途と明示した上でデプロイ。本番化時は実ウォレット連携を設計 |
| 6 | Stripe Webhook の受信エンドポイント（ec-backend）が外部から到達可能である必要 | 中 | ec-backend を LB 経由で公開、Stripe Webhook の署名検証を実装済みであることを確認 |
