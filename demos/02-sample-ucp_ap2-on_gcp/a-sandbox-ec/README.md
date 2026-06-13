<p align="center">
  <a href="https://www.medusajs.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>
<h1 align="center">Medusa DTC Starter（サンドボックス EC）</h1>

Medusa v2 + Next.js 15 で構成された EC サイトのサンドボックス環境。
UCP / AP2 のデモ用途として、Stripe 決済を組み込んだ状態で提供しています。

---

## 構成

| レイヤー | 技術 | URL |
|---|---|---|
| バックエンド（API / Admin） | Medusa v2 | `http://localhost:9000` |
| ストアフロント | Next.js 15 | `http://localhost:8000` |
| Admin ダッシュボード | Medusa Admin | `http://localhost:9000/app` |
| データベース | PostgreSQL | `localhost:5432` |
| キャッシュ | Redis | `localhost:6379` |

---

## 前提条件

- **Node.js** v20 以上
- **npm** v10 以上
- **PostgreSQL** v15 以上（ローカル起動済み）
- **Redis** v7 以上（ローカル起動済み）

---

## 1. PostgreSQL の準備

### 起動確認

```bash
# macOS（Homebrew）の場合
brew services start postgresql@15

# 起動状態を確認
brew services list | grep postgresql
```

### データベース作成

```bash
# PostgreSQL に接続
psql postgres

# データベースを作成（接続ユーザー名を確認してから実行）
CREATE DATABASE "medusa-a-sandbox-ec-2";

# 作成確認
\l

# 終了
\q
```

### 接続確認

```bash
psql postgres://$(whoami)@localhost/medusa-a-sandbox-ec-2 -c "SELECT 1;"
```

`1` が返れば接続成功です。

---

## 2. Redis の準備

```bash
# macOS（Homebrew）の場合
brew services start redis

# 起動確認
redis-cli ping
# → PONG が返れば OK
```

---

## 3. 依存パッケージのインストール

```bash
# リポジトリルート（a-sandbox-ec/）で実行
npm install
```

---

## 4. 環境変数の設定

### バックエンド（`apps/backend/.env`）

ファイルが存在しない場合は作成してください。

```bash
MEDUSA_ADMIN_ONBOARDING_TYPE=nextjs
STORE_CORS=http://localhost:8000,https://docs.medusajs.com
ADMIN_CORS=http://localhost:5173,http://localhost:9000,https://docs.medusajs.com
AUTH_CORS=http://localhost:5173,http://localhost:9000,http://localhost:8000,https://docs.medusajs.com
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecret
COOKIE_SECRET=supersecret
DATABASE_URL=postgres://<あなたのOSユーザー名>@localhost/medusa-a-sandbox-ec-2
MEDUSA_ADMIN_ONBOARDING_NEXTJS_DIRECTORY=a-sandbox-ec/apps/storefront

# Stripe（後述）
STRIPE_API_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

> `DATABASE_URL` の `<あなたのOSユーザー名>` は `whoami` コマンドで確認できます。

### ストアフロント（`apps/storefront/.env.local`）

```bash
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<Admin で取得した公開 API キー>
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_DEFAULT_REGION=dk
NEXT_PUBLIC_BASE_URL=https://localhost:8000
NEXT_PUBLIC_STRIPE_KEY=pk_test_xxxx   # Stripe 公開キー（後述）
NODE_ENV=development
```

---

## 5. データベースマイグレーション

```bash
cd apps/backend
npm run build
npx medusa db:migrate
```

---

## 6. バックエンドの起動

```bash
# a-sandbox-ec/ ルートで実行
npm run dev

# または、バックエンドのみ起動
cd apps/backend
npm run dev
```

バックエンドが起動したら `http://localhost:9000/health` にアクセスして `{"status":"ok"}` が返ることを確認してください。

---

## 7. Admin アカウントの作成

バックエンド起動後、以下のコマンドで管理者ユーザーを作成します。

```bash
cd apps/backend
npx medusa user -e admin@example.com -p yourpassword
```

> メールアドレスとパスワードは任意の値を設定してください。

作成後、`http://localhost:9000/app` にアクセスし、設定したメールアドレスとパスワードでログインできます。

---

## 8. Medusa 公開 API キーの取得

1. `http://localhost:9000/app` に Admin ログイン
2. **Settings** → **Publishable API Keys**
3. 既存のキーをコピー、または「Create」で新規作成
4. 取得した `pk_...` の値を `apps/storefront/.env.local` の `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` に設定

---

## 9. ストアフロントの起動

```bash
cd apps/storefront
npm run dev
```

`http://localhost:8000` でストアフロントが起動します。

---

## 10. Stripe 決済の設定

### 必要なキーの取得

[Stripe ダッシュボード（テストモード）](https://dashboard.stripe.com/test/apikeys) から以下を取得してください。

| キー | 設定ファイル | 変数名 |
|---|---|---|
| シークレットキー（`sk_test_...`） | `apps/backend/.env` | `STRIPE_API_KEY` |
| 公開キー（`pk_test_...`） | `apps/storefront/.env.local` | `NEXT_PUBLIC_STRIPE_KEY` |

### Admin でリージョンに Stripe を有効化

1. `http://localhost:9000/app` → **Settings** → **Regions**
2. 対象リージョン（例: Europe）を選択
3. **Payment Providers** → `stripe` を有効化して保存

### Webhook の設定（本番環境のみ）

ローカル開発では Webhook 設定は不要です。本番環境にデプロイする場合は以下を設定してください。

- **エンドポイント URL**: `https://<your-domain>/hooks/payment/stripe_stripe`
- **リッスンするイベント**:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.amount_capturable_updated`
  - `payment_intent.partially_funded`
- 発行された `whsec_...` を `apps/backend/.env` の `STRIPE_WEBHOOK_SECRET` に設定

### 動作確認（テストカード）

チェックアウト画面で以下のテストカード情報を使用してください。

| 項目 | 値 |
|---|---|
| カード番号 | `4242 4242 4242 4242` |
| 有効期限 | 任意の未来日（例: `12/34`） |
| CVC | 任意の3桁（例: `123`） |

---

## 環境変数リファレンス

### バックエンド（`apps/backend/.env`）

| 変数名 | 説明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 接続 URL |
| `REDIS_URL` | Redis 接続 URL |
| `JWT_SECRET` | JWT 署名シークレット |
| `COOKIE_SECRET` | Cookie 署名シークレット |
| `STRIPE_API_KEY` | Stripe シークレットキー（`sk_test_...`） |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 署名シークレット（`whsec_...`） |

### ストアフロント（`apps/storefront/.env.local`）

| 変数名 | 説明 |
|---|---|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Medusa Admin で発行した公開 API キー |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | Medusa バックエンド URL（デフォルト: `http://localhost:9000`） |
| `NEXT_PUBLIC_DEFAULT_REGION` | デフォルトリージョンのカントリーコード（例: `dk`） |
| `NEXT_PUBLIC_BASE_URL` | ストアフロントのベース URL |
| `NEXT_PUBLIC_STRIPE_KEY` | Stripe 公開キー（`pk_test_...`） |

---

## トラブルシューティング

### バックエンドが起動しない

- PostgreSQL・Redis が起動しているか確認: `brew services list`
- `DATABASE_URL` のユーザー名を確認: `whoami`
- マイグレーションが完了しているか確認: `npx medusa db:migrate`

### Admin にログインできない

- 管理者ユーザーを作成したか確認（手順 7 参照）
- バックエンドが起動中か確認: `curl http://localhost:9000/health`

### Stripe の決済ボタンが表示されない

- Admin でリージョンに Stripe を有効化しているか確認（手順 10 参照）
- `NEXT_PUBLIC_STRIPE_KEY` に正しい公開キーが設定されているか確認
- ストアフロントを再起動（環境変数変更後は再起動が必要）

---

## 参考リンク

- [Medusa ドキュメント](https://docs.medusajs.com)
- [Stripe 決済モジュール（バックエンド）](https://docs.medusajs.com/resources/commerce-modules/payment/payment-provider/stripe)
- [Stripe 決済実装（ストアフロント）](https://docs.medusajs.com/resources/storefront-development/checkout/payment/stripe)
