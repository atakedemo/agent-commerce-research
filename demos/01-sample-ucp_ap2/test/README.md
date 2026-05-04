# MCP Conformance Tests

`b-mcp-server` の MCP ツールに対する適合性テスト。  
対象ツールは [`docs/mcp-reference.md`](../docs/mcp-reference.md) に記載の全12ツール。

---

## 前提条件

- Node.js v18 以上
- `b-mcp-server` の依存インストール済み（下記「セットアップ」参照）

---

## セットアップ

初回のみ、**b-mcp-server と test の両方**に依存をインストールする。

```bash
# 1. MCP サーバ側
cd demos/01-sample-ucp_ap2/b-mcp-server
npm install

# 2. テスト側
cd demos/01-sample-ucp_ap2/test
npm install
```

---

## テストの実行

以下はすべて `demos/01-sample-ucp_ap2/test/` から実行する。

### 全テストを一括実行

```bash
npm test
```

### ツール種別ごとに実行

```bash
npm run test:checkout   # create / get / update / complete / cancel_checkout
npm run test:catalog    # search_catalog / get_product / lookup_catalog
npm run test:cart       # create_cart / get_cart / update_cart / cancel_cart
```

### ファイルを直接指定して実行

```bash
node --test --test-reporter=spec checkout.test.js
node --test --test-reporter=spec catalog.test.js
node --test --test-reporter=spec cart.test.js
```

---

## テスト構成

```
test/
├── package.json           # npm scripts
├── helpers/
│   └── mcp-client.js      # サーバ起動・callTool ヘルパー
├── checkout.test.js       # §9–§13: checkout 5 ツール
├── catalog.test.js        # §3–§5:  catalog 3 ツール（現在 skip）
└── cart.test.js           # §6–§8:  cart 4 ツール（現在 skip）
```

テストは `node --test` でサーバプロセスを stdio 経由でサブプロセスとして起動し、MCP JSON-RPC でツールを呼び出す。各 `describe` ブロックが独立したサーバプロセスを持つ。

---

## 現在の合格状況

### `checkout.test.js`（21 テスト）

| テストグループ | 内容 | 状態 |
| --- | --- | --- |
| `create_checkout (§9)` | id・status・ucp_meta・payload の検証 | ✅ pass |
| `get_checkout (§10)` | 取得・not_found | ✅ pass |
| `update_checkout (§11)` | マージ・フィールド保持・not_found | ✅ pass |
| `complete_checkout (§12)` | 完了・idempotency-key・not_found | ✅ pass |
| `cancel_checkout (§13)` | キャンセル・idempotency-key・not_found | ✅ pass |
| `lifecycle: create → update → complete` | 状態遷移の連続確認 | ✅ pass |
| `lifecycle: create → cancel` | 状態遷移の連続確認 | ✅ pass |
| `state invariants` | 不正な状態遷移を拒否すること | ❌ **3 fail** |

**失敗している 3 テスト**（Phase 2 で修正予定）:

| テスト | 期待する動作 |
| --- | --- |
| `complete_checkout: cannot complete a canceled checkout` | canceled → complete はエラー |
| `update_checkout: cannot update a canceled checkout` | canceled → update はエラー |
| `cancel_checkout: cannot cancel a completed checkout` | completed → cancel はエラー |

### `catalog.test.js`（12 テスト）

全テスト **skip** — `b-mcp-server` が catalog ツールを未実装のため。  
テスト本体はコメントアウトで残置済み。実装後にコメントを解除する。

### `cart.test.js`（12 テスト）

全テスト **skip** — `b-mcp-server` が cart ツールを未実装のため。  
テスト本体はコメントアウトで残置済み。実装後にコメントを解除する。

---

## テストケース詳細

### `checkout.test.js`

#### `create_checkout (§9)` — 4 テスト

| # | テストケース | 検証内容 | 状態 |
| --- | --- | --- | --- |
| 1 | returns id starting with co_ and status=incomplete | `id` が `co_` 始まり、`status === "incomplete"` | ✅ pass |
| 2 | echoes ucp-agent profile in ucp_meta | `ucp_meta["ucp-agent"].profile` が送信値と一致 | ✅ pass |
| 3 | stores checkout payload in checkout field | レスポンスの `checkout.line_items` が送信値と一致 | ✅ pass |
| 4 | accepts idempotency-key in meta without error | `idempotency-key` 付き meta でもエラーにならない | ✅ pass |

#### `get_checkout (§10)` — 2 テスト

| # | テストケース | 検証内容 | 状態 |
| --- | --- | --- | --- |
| 1 | retrieves a previously created checkout by id | `id` 一致・`status === "incomplete"` | ✅ pass |
| 2 | returns checkout_not_found for unknown id | `isError === true`・`error === "checkout_not_found"` | ✅ pass |

#### `update_checkout (§11)` — 3 テスト

| # | テストケース | 検証内容 | 状態 |
| --- | --- | --- | --- |
| 1 | merges fields and transitions to ready_for_complete | `status === "ready_for_complete"`・`checkout.email` 反映 | ✅ pass |
| 2 | preserves existing checkout fields after partial update | 部分更新後も `checkout.line_items` が元値を保持 | ✅ pass |
| 3 | returns checkout_not_found for unknown id | `isError === true`・`error === "checkout_not_found"` | ✅ pass |

#### `complete_checkout (§12)` — 2 テスト

| # | テストケース | 検証内容 | 状態 |
| --- | --- | --- | --- |
| 1 | transitions to completed and echoes idempotency-key | `status === "completed"`・`ucp_meta["idempotency-key"]` が送信 key と一致 | ✅ pass |
| 2 | returns checkout_not_found for unknown id | `isError === true`・`error === "checkout_not_found"` | ✅ pass |

#### `cancel_checkout (§13)` — 2 テスト

| # | テストケース | 検証内容 | 状態 |
| --- | --- | --- | --- |
| 1 | transitions to canceled and echoes idempotency-key | `status === "canceled"`・`ucp_meta["idempotency-key"]` が送信 key と一致 | ✅ pass |
| 2 | returns checkout_not_found for unknown id | `isError === true`・`error === "checkout_not_found"` | ✅ pass |

#### `lifecycle: create → update → complete` — 2 テスト

| # | テストケース | 検証内容 | 状態 |
| --- | --- | --- | --- |
| 1 | transitions incomplete → ready_for_complete → completed | 3ステップ連続でステータス遷移を確認 | ✅ pass |
| 2 | get_checkout reflects final completed state | complete 後に get すると `status === "completed"` | ✅ pass |

#### `lifecycle: create → cancel` — 2 テスト

| # | テストケース | 検証内容 | 状態 |
| --- | --- | --- | --- |
| 1 | transitions incomplete → canceled | cancel 後に `status === "canceled"` | ✅ pass |
| 2 | get_checkout reflects final canceled state | cancel 後に get すると `status === "canceled"` | ✅ pass |

#### `state invariants` — 4 テスト

| # | テストケース | 検証内容 | 状態 |
| --- | --- | --- | --- |
| 1 | update_checkout: completed checkout keeps completed status | complete 済みを update しても `status === "completed"` を維持 | ✅ pass |
| 2 | complete_checkout: cannot complete a canceled checkout | cancel 済みを complete しようとすると `isError === true` | ❌ fail |
| 3 | update_checkout: cannot update a canceled checkout | cancel 済みを update しようとすると `isError === true` | ❌ fail |
| 4 | cancel_checkout: cannot cancel a completed checkout | complete 済みを cancel しようとすると `isError === true` | ❌ fail |

---

### `catalog.test.js`（全 skip）

#### `search_catalog (§3)` — 6 テスト

| # | テストケース | 検証内容 |
| --- | --- | --- |
| 1 | returns products array and pagination for a keyword query | `products` が配列・`pagination` が存在 |
| 2 | returns empty products array when no results match | `products === []` |
| 3 | supports filter by category | `filters.categories` 指定時も `products` が配列 |
| 4 | supports price filter (max) | 全 variant の `price.amount <= max` |
| 5 | supports pagination via limit and cursor | `has_next_page` 確認・cursor で次ページ取得 |
| 6 | returns ucp capability block in response | `ucp.capabilities["dev.ucp.shopping.catalog.search"]` が存在 |

#### `get_product (§4)` — 3 テスト

| # | テストケース | 検証内容 |
| --- | --- | --- |
| 1 | returns product details by id including options and variants | `product.id` 一致・`options` と `variants` が配列 |
| 2 | filters variants when selected options are provided | `selected` 指定時、返却 variants が条件に合致 |
| 3 | returns error for unknown product id | `isError === true` |

#### `lookup_catalog (§5)` — 3 テスト

| # | テストケース | 検証内容 |
| --- | --- | --- |
| 1 | resolves multiple product ids in a single call | 2 ID 指定で `products.length === 2` |
| 2 | returns only found ids when some ids are unknown | 存在しない ID を含む場合、見つかった分だけ返却 |
| 3 | returns ucp capability block in response | `ucp.capabilities["dev.ucp.shopping.catalog.lookup"]` が存在 |

---

### `cart.test.js`（全 skip）

#### `create_cart (§6)` — 3 テスト

| # | テストケース | 検証内容 |
| --- | --- | --- |
| 1 | creates a cart and returns id, line_items, totals, continue_url | `id`・`line_items`・`totals`・`continue_url` が存在 |
| 2 | creates a cart with no line_items (empty cart) | 空 `line_items` でも `id` が返る |
| 3 | returns ucp capability block in response | `ucp.capabilities["dev.ucp.shopping.cart"]` が存在 |

#### `get_cart (§7)` — 2 テスト

| # | テストケース | 検証内容 |
| --- | --- | --- |
| 1 | retrieves cart snapshot by id | `id` 一致・`line_items.length === 1` |
| 2 | returns error for unknown cart id | `isError === true` |

#### `update_cart (§8)` — 4 テスト

| # | テストケース | 検証内容 |
| --- | --- | --- |
| 1 | replaces entire cart with new line_items state | 更新後 `line_items.length === 2`（全体置換） |
| 2 | adding items follows get → merge → update pattern | get → スプレッド → update で `line_items` が 1 件増える |
| 3 | recalculates totals after update | 更新後 `totals` の `subtotal.amount > 0` |
| 4 | returns error for unknown cart id | `isError === true` |

#### `cancel_cart (§8 / cancel)` — 3 テスト

| # | テストケース | 検証内容 |
| --- | --- | --- |
| 1 | cancels an active cart | `status === "canceled"` |
| 2 | returns error for unknown cart id | `isError === true` |
| 3 | canceled cart cannot be updated | cancel 後に update すると `isError === true` |

---

## Phase 別の目標

| Phase | 目標 |
| --- | --- |
| Phase 1（現在） | テスト環境の構築。checkout テストが実行でき、CRUD・ライフサイクルは通過 |
| Phase 2 | `b-mcp-server` にモック実装を追加し、`checkout.test.js` 全 21 テストを pass にする |
| Phase 3 | Medusa バックエンドと連携し、catalog・cart テストのコメントアウトを解除して全テストを pass にする |

---

## ヘルパー API（`helpers/mcp-client.js`）

| エクスポート | 型 | 説明 |
| --- | --- | --- |
| `META` | `object` | 全ツール共通の `ucp-agent` meta |
| `metaWithKey(key?)` | `(string?) → object` | `idempotency-key` 付き meta を生成（complete / cancel 用） |
| `createMcpClient()` | `async → Client` | サーバプロセスを起動して MCP Client を返す。テスト終了時に `client.close()` を呼ぶ |
| `callTool(client, name, args)` | `async → { isError, data }` | ツールを呼び出し、結果を `{ isError: boolean, data: object }` に正規化 |
