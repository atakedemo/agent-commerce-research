# このインサイトで参照するリポジトリ

[agent-commerce-research issue #4](https://github.com/atakedemo/agent-commerce-research/issues/4)（AP2 のプロトコル理解・論点整理）に対応する調査置き場。

## Target

* [google-agentic-commerce / AP2](https://github.com/google-agentic-commerce/AP2)（Agent Payments Protocol の仕様・型・サンプル）

## References

### Must

* ワークスペース内ミラー: `references/specification/community/AP2/`（Issue で指定されたデータソースと同一リポジトリのスナップショット）
* **Python サンプル**: [リポジトリの `samples/python`](https://github.com/google-agentic-commerce/AP2/tree/main/samples/python)（ワークスペースでは `references/specification/community/AP2/samples/python/`）— [Issue #4 コメント](https://github.com/atakedemo/agent-commerce-research/issues/4#issuecomment-4230817462) で **Must** 指定
* 中核仕様: `docs/specification.md`
* A2A との IF: `docs/a2a-extension.md`
* ロードマップ: `docs/roadmap.md`

### Should

* 概念・用語: `docs/topics/what-is-ap2.md`, `docs/topics/core-concepts.md`, `docs/glossary.md`
* プライバシー・セキュリティ: `docs/topics/privacy-and-security.md`
* AP2 と A2A / MCP: `docs/topics/ap2-a2a-and-mcp.md`
* x402・決済手段の位置づけ: `docs/topics/ap2-and-x402.md`
* 型定義（データモデルの実装参照）: `src/ap2/types/`

### May

* サンプルシナリオ: `samples/python/scenarios/`, `samples/go/scenarios/`
* 変更履歴: `CHANGELOG.md`
* Target リポジトリの **open Issue** スナップショット: 本ディレクトリの [`open-issues-filtered.md`](./open-issues-filtered.md)（[Issue #4 コメント](https://github.com/atakedemo/agent-commerce-research/issues/4#issuecomment-4230878507) 由来）
