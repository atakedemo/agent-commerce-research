# 設計概要

このリポジトリ（a-sandbox-ec）は、Medusa v2 バックエンドと Next.js 15 ストアフロントからなるモノレポであり、[Medusa DTC Starter](https://github.com/medusajs/dtc-starter) 系の構成で、商品閲覧・カート・チェックアウト・会員と注文管理までを一つのデモ用 EC サンドボックスとしてまとめている。

## 目的

本サンドボックスの主な目的は、ヘッドレスコマースの「API バックエンド + 店頭 UI」をローカルで一括起動し、カスタム API や Admin、ストアフロントの拡張ポイントを追いやすい形で保持することである。本番用の全機能網羅ではなく、Medusa 標準のコアフロー（リージョン・販売チャネル・注文・カート等）上に、最小限のカスタムルート（`/store/custom`・`/admin/custom`）を置けることを前提とする。

## ディレクトリ構成

```
a-sandbox-ec/
├── package.json                 # ワークスペース / turbo スクリプト
├── turbo.json
├── apps/
│   ├── backend/                 # Medusa 2.14 アプリケーション
│   │   ├── medusa-config.ts
│   │   ├── instrumentation.ts
│   │   └── src/
│   │       ├── api/              # ファイルベース API ルート
│   │       ├── admin/            # Admin 拡張（i18n 等）
│   │       ├── migration-scripts/ # 初期シード
│   │       ├── modules/
│   │       ├── subscribers/
│   │       └── workflows/
│   └── storefront/               # Next.js 15 ストアフロント
│       └── src/
│           ├── app/              # App Router（[countryCode] 等）
│           ├── lib/              # JS SDK ラッパ、データ取得、クッキー
│           ├── modules/         # 画面用コンポーネント群
│           └── middleware.ts
└── docs/                         # 本ドキュメント
    ├── design-overview.md
    ├── state-transition.md
    └── er.md
```

## システム構成

- **ストアフロント（`apps/storefront`）**: Next.js が `[countryCode]` プレフィックス付き URL で国・リージョンを解釈し、`@medusajs/js-sdk` 経由で Medusa Store API を呼び出す。ミドルウェアでリージョン解決とクッキー付与を行う。
- **バックエンド（`apps/backend`）**: Medusa が PostgreSQL 上にコマースドメインを永続化し、Store/Admin 向け HTTP API、埋め込み Admin、シード用ワークフロー（`initial-data-seed`）を提供する。

## 主要コンポーネント

### バックエンド HTTP / 設定
- 対応ファイル: `apps/backend/medusa-config.ts`
- 責務: データベース接続、CORS、JWT / Cookie シークレット等の `projectConfig` を環境変数から読み込み、Medusa サーバの挙動を定義する。

### カスタム Store / Admin ルート
- 対応ファイル: `apps/backend/src/api/store/custom/route.ts`、`apps/backend/src/api/admin/custom/route.ts`
- 責務: Medusa のファイルベースルーティングに沿ったサンプル GET。疎通確認や拡張の足がかりとして置かれている（現状は 200 のみ返却）。

### 初期データシード
- 対応ファイル: `apps/backend/src/migration-scripts/initial-data-seed.ts`
- 責務: `createSalesChannelsWorkflow`、`createRegionsWorkflow`、`createProductsWorkflow` 等のコアフローで、販売チャネル、API キー、店舗、リージョン、税、商品・在庫・配送オプションなどのデモ用データを投入する。

### ストアフロント SDK とデータ層
- 対応ファイル: `apps/storefront/src/lib/config.ts`、`apps/storefront/src/lib/data/cart.ts` 他
- 責務: `Medusa` JS SDK インスタンス（publishable key・base URL）を提供し、Server Action 等から `/store/carts` 等を呼び、カート ID のクッキー管理とキャッシュ再検証（`revalidateTag`）を行う。

### リージョン解決ミドルウェア
- 対応ファイル: `apps/storefront/src/middleware.ts`
- 責務: バックエンドの `GET /store/regions` を（Edge 互換の `fetch` で）呼び、URL・地理情報・既存クッキーから国コードを決め、以降の料金表示・配達エリアの前提となるリージョン文脈を揃える。

## 主要データ

- **Store / SalesChannel / ApiKey（publishable）**: 店舗と販売チャネル、店頭用公開 API キーの紐づけ。シードで作成される（`createStoresWorkflow` 等）。
- **Region / Country / Tax**: 多地域・多通貨の前提。シードの `countries` 配列と `createRegionsWorkflow`、`createTaxRegionsWorkflow` に対応。
- **Product / ProductVariant / Collection / Category**: カタログ。シードの `createProductsWorkflow` 等で投入。
- **Cart / LineItem（store）**: 未ログイン・ログイン問わず、ストア API 上の一時的な買い物かご。ID はクッキーで追跡（`getCartId` / `setCartId`）。
- **Order / Customer / Address**: 注文確定後の永続レコード。顧客アカウント・注文履歴画面のデータソース。エンティティ定義の本体は Medusa コア（PostgreSQL スキーマ）側にある。

## リクエスト/状態の流れ

1. 利用者がストアの URL（例: `/[countryCode]/...`）にアクセスする。
2. `middleware.ts` がリージョン一覧を取得し、国コードとリージョンを解決し、必要なクッキーを付与する。
3. ページと Server Action が `sdk` 経由で `retrieveCart`・商品一覧取得等を行い、カート未作成なら `getOrSetCart` で新規カートを作成しクッキーに保存する。
4. チェックアウト完了後、Medusa 側で注文が確定し、確認ページ・マイアカウントの注文一覧で同じ注文 ID を参照する。

## 制約と補足

- ドメインエンティティのスキーマは Medusa フレームワークが提供する DB 移行群に従い、本リポジトリ独自の大規模なデータモデル追加は想定されない（カスタムは主に `src/api`・ワークフロー・Admin/Storefront 側）。
- カスタム API (`/store/custom`・`/admin/custom`) はプレースホルダーに近い最小実装である。
- README に記載の「Order transfer between accounts（アカウント間の注文引き継ぎ）」は、ストアフロントの `order/.../transfer/...` ルート等で扱うフローが含まれる（標準 DTC スタータの範囲）。

## カスタマイズを行う対象

### フロントエンド

#### Medusa JS SDK の接続先と公開キー

`apps/storefront/src/lib/config.ts` で、バックエンド URL および `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` 相当の `publishableKey` を SDK に渡す。接続先変更や本番用キー切替はここ（と `.env.local`）が起点になる。

```typescript
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})
```

#### 国・リージョンの前処理

`apps/storefront/src/middleware.ts` は Edge 上で `GET ${BACKEND_URL}/store/regions` を呼び、国コードマップを構築する。バックエンド URL 未設定時は例外になるため、新環境ではこの前提を満たす。

```typescript
if (!BACKEND_URL) {
  throw new Error(
    "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable."
  )
}
```

#### カート取得と再検証

`apps/storefront/src/lib/data/cart.ts` の `retrieveCart` は `sdk.client.fetch` で `/store/carts/${id}` を呼び、フィールド拡張やキャッシュタグ（`getCacheOptions("carts")`）と連携する。カート項目の取り扱いを変える場合は、ここと `getOrSetCart` 周辺を追う。

```typescript
return await sdk.client
  .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
    method: "GET",
    query: { fields },
    headers,
    next,
    cache: "force-cache",
  })
  .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
  .catch(() => null)
```

#### 価格・リージョン付きのカート新規作成

`getOrSetCart` でリージョン未解決時は例外とし、カート未存在時に `sdk.store.cart.create` で `region_id` と `locale` を渡して作成する。新しい必須パラメータをカートに載せる場合の典型的な拡張点である。

```typescript
if (!cart) {
  const locale = await getLocale()
  const cartResp = await sdk.store.cart.create(
    { region_id: region.id, locale: locale || undefined },
    {},
    headers
  )
  cart = cartResp.cart
  await setCartId(cart.id)
}
```

### バックエンド

#### 環境に依存するプロジェクト設定

`apps/backend/medusa-config.ts` の `defineConfig` で、DB 接続と CORS、JWT / Cookie シークレットを定義する。ローカルと本番で差し替わる主な箇所である。

```typescript
module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  }
})
```

#### 店舗向けカスタム API のエンドポイント

`apps/backend/src/api/store/custom/route.ts` は `/store/custom` への GET を実装する。独自の集約レスポンスや Webhook 互換の入口を足す場合は、同階層の `route.ts` パターンに倣い HTTP メソッドをエクスポートして拡張する。

```typescript
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  res.sendStatus(200);
}
```

#### 管理向けカスタム API

`apps/backend/src/api/admin/custom/route.ts` は Admin 用のプレースホルダ。バックオフィス専用の集計や一括操作 API を足す場合の配置例である。

```typescript
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  res.sendStatus(200);
}
```

#### 初期シード（マスター・在庫・商品の投入方針）

`apps/backend/src/migration-scripts/initial-data-seed.ts` 先頭付近で、販売チャネル・API キー・店舗を作成し、以降のリージョン・税・商品・在庫に繋げる。ローカル DB を「決まったデモ状態」に揃えたい場合の中心ファイルである。

```typescript
} = await createSalesChannelsWorkflow(container).run({
  input: {
    salesChannelsData: [
      {
        name: "Default Sales Channel",
        description: "Created by Medusa",
      },
    ],
  },
});
```
