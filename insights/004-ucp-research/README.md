# このインサイトで参照するリポジトリ

[agent-commerce-research issue #5](https://github.com/atakedemo/agent-commerce-research/issues/5)（UCP のプロトコル理解・設計パターン整理）に対応する調査置き場。

## Target

* [Universal-Commerce-Protocol / ucp](https://github.com/Universal-Commerce-Protocol/ucp)

## References

### Must

* **規格ソース（本家と同一扱い）**: `references/specification/community/ucp/` — [Universal-Commerce-Protocol/ucp](https://github.com/Universal-Commerce-Protocol/ucp) を `origin` とする Git クローン。調査では `origin/main` 先端のツリーと GitHub 上の同リポジトリ `main` に差分がないものとして読む（いわゆる「ミラー遅れ」の前提は置かない）。
* Issue で明示された公式サンプル（本リポジトリでは同等の実装を `samples/` に保持）
  * A2A 系: [samples/tree/main/a2a](https://github.com/Universal-Commerce-Protocol/samples/tree/main/a2a) → `samples/01-sample-a2a/`
  * REST 系: [samples/tree/main/rest/python/server](https://github.com/Universal-Commerce-Protocol/samples/tree/main/rest/python/server) → `samples/02-sample-restapi/server/`
* 全体仕様の入口: `docs/specification/overview.md`

### Should

* REST binding: `docs/specification/checkout-rest.md`, `source/services/shopping/rest.openapi.json`
* 認証・署名: `docs/specification/identity-linking.md`, `docs/specification/signatures.md`
* 決済ハンドラ: `docs/specification/payment-handler-guide.md`, `source/schemas/payment_handler.json`
* ロードマップ: `docs/documentation/roadmap.md`
* Target リポジトリの **open Issue**（調査時点）: GitHub 上の `Universal-Commerce-Protocol/ucp`（`is:issue is:open`）

### May

* 型・スキーマ群: `source/schemas/shopping/`
* MCP / Embedded: `docs/specification/checkout-mcp.md`, `docs/specification/embedded-checkout.md`
