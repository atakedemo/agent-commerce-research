# `docs/` ドキュメント一覧

本ディレクトリは **a-sandbox-ec**（Medusa v2 バックエンド + Next.js ストアフロント）および **UCP Shopping / MCP** 連携に関する設計・API・図表をまとめる。ファイルごとの記載内容は以下のとおり。


| ファイル                                         | 内容                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[design-overview.md](design-overview.md)`   | リポジトリの目的、モノレポ構成（`apps/backend` / `apps/storefront`）、主要コンポーネントの責務、データモデル概念、リクエスト〜注文までの流れ、制限事項などの**設計概要**。                                                                                                                 |
| `[api-reference.md](api-reference.md)`       | `apps/backend`（Medusa 2.14）向けの **HTTP API 一覧**。カスタム 2 ルート（`/store/custom` / `/admin/custom`）、認証（Auth）、本デモで使う Store API、Admin の抜粋、共通ヘッダ・`curl` 例。MCP は含めず `[mcp-reference.md](mcp-reference.md)` を参照。                     |
| `[openapi.yaml](openapi.yaml)`               | `[api-reference.md](api-reference.md)` に列挙した HTTP API を **OpenAPI 3.0** で表現したもの。完全スキーマは Medusa 公式 Store/Admin を正とする記載。**MCP Tools は含まない**（人向けは `mcp-reference.md`、OpenRPC は `references/ucp-shopping-mcp.openrpc.json`）。 |
| `[mcp-reference.md](mcp-reference.md)`       | `**b-mcp-server`** の MCP Tools 設計。UCP Shopping OpenRPC との対応、単一 MCP endpoint 前提、`meta` 共通入力、カタログ・カート・チェックアウト各 Tool と Store API の対応表、チェックアウト系の入出力・例。HTTP とは別系統（stdio / JSON-RPC）。                                          |
| `[sequence.md](sequence.md)`                 | **UCP 接続のシーケンス**（設計素案）。ユーザー・エージェント FE/BE・既存 EC（MCP / バックエンド）間のやりとりを、商品検索・詳細、カート追加、チェックアウト完了までの Mermaid シーケンス図で整理。Issue #9 系の前提・規格リンク付き。                                                                                  |
| `[state-transition.md](state-transition.md)` | **状態遷移図**（Mermaid）。ストアフロント上のユースケース段階（訪問〜注文確認）と、Medusa コアにおける注文・支払い・履行の代表的な概念遷移。                                                                                                                                          |
| `[er.md](er.md)`                             | **ER 図**（Mermaid）。Medusa v2 コアコマースモジュール上の主要エンティティ関係を概念レベルで記載。シード・ストアフロントとの整合、SDK 型との関係の注意。                                                                                                                               |


## 参照の読み分け

- **ブラウザや SDK から叩く REST** → `[api-reference.md](api-reference.md)` / `[openapi.yaml](openapi.yaml)`
- **エージェント・MCP ツール** → `[mcp-reference.md](mcp-reference.md)`、全体フロー → `[sequence.md](sequence.md)`
- **アーキテクチャの鸟瞰** → `[design-overview.md](design-overview.md)`
- **ドメイン関係・業務状態** → `[er.md](er.md)` / `[state-transition.md](state-transition.md)`

