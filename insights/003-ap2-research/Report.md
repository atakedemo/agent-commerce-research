# 調査レポート

## 対象Issue

* **参照**: [AP2の理解 #4](https://github.com/atakedemo/agent-commerce-research/issues/4)
* **タイトル**: AP2の理解
* **内容の要約**: データソースとして [google-agentic-commerce/AP2](https://github.com/google-agentic-commerce/AP2) を指定し、**(1) 対象ディレクトリの構造**、**(2) 規格で定めている内容（データモデル、IF 定義、認証認可）**、**(3) 個別調査トピック（サポートする決済手段、MCP サポートの状況）**、**(4) 検討状況（活発な Issue、最新リリースの範囲）** を整理することが求められている。

## 調査対象ディレクトリ

* **パス**: `insights/003-ap2-research/`
* **確認したファイル**: 本ディレクトリの `README.md`、および `README.md` の **Must / Should** に従い参照した `references/specification/community/AP2/` 配下の仕様・ドキュメント・型定義。GitHub 上の [AP2](https://github.com/google-agentic-commerce/AP2) については、リリース情報および open Issue の一覧（API）を補助的に参照した。

## エグゼクティブサマリー

AP2（Agent Payments Protocol）は、エージェント主導の決済における**意図の検証可能性と説明責任**を、**検証可能デジタルクレデンシャル（VDC）としての Mandate**（Cart / Intent / Payment）と、**A2A プロトコル上の拡張（メッセージ・アーティファクトへのデータ載せ）**として定義している。IF は OpenAPI 型の REST 仕様というより **A2A の DataPart プロファイルと AgentCard 拡張**が中心である。決済手段は **v0.1 でプル型（カード等）**が主眼で、**x402 やデジタル通貨は「設計上の拡張性」と別リポジトリ連携**として位置づけられる。**MCP は Merchant Endpoint 等の記述とロードマップ上の「AP2 MCP server v0.1」**で示されるが、**v0.1 時点では参照実装・標準バインディングは未完了**に近い。GitHub では **Human-present の承認チェーンや AP2/A2A 境界のチャレンジフロー**など、**文書・仕様のギャップ**を指摘する Issue が目立つ。

## Issue要約

* **目的**: AP2 プロトコルについて、指定データソースに基づき論点を整理する。
* **論点（Issue 本文より）**:
  * 対象ディレクトリの構造
  * 規格: データモデル、IF 定義、認証認可
  * 個別: サポートする決済手段、MCP サポートの状況
  * 検討状況: 議論が集中している Issue、最新リリースに含まれる内容

## 分析

### 対象ディレクトリの構造

リポジトリは **サンプル実装・型定義・MkDocs 仕様**の三層に分かれている。ルート `README.md` は **`samples`** を主要デモ領域とし、シナリオは `samples/python/scenarios` および `samples/android/scenarios` に配置されると明示している。中核のプロトコル記述は **`docs/`**（`specification.md`、`topics/`、`a2a-extension.md` 等）、機械可読な型は **`src/ap2/types/`** に集約されている。第2階層の概観は次のとおりである。

```
AP2/
├── docs/                 # 仕様本文・トピック別解説・ロードマップ（MkDocs）
├── src/ap2/types/        # Mandate・W3C Payment Request 由来オブジェクト等（Pydantic）
├── samples/              # python / go / android の参照実装・シナリオ
├── .github/              # CI、release-please 等
└── README.md, CHANGELOG.md, mkdocs.yml, ...
```

この分解は、「**規格の自然言語＋図**（`docs`）」「**スキーマに近い型**（`src`）」「**エンドツーエンドの動作例**（`samples`）」という役割分担を示している。

### 規格にて定めている内容

#### データモデル

中核は **Cart Mandate、Intent Mandate、Payment Mandate** という VDC と、カート内容・決済要求に **W3C Payment Request API 由来の `PaymentRequest` 等**を用いる点である（`docs/specification.md` Section 4、`src/ap2/types/mandate.py`、`src/ap2/types/payment_request.py`）。A2A 上では `ap2.mandates.CartMandate` 等のキーで DataPart に載せることが `docs/a2a-extension.md` に例示されている。**Human-present / Human-not-present** で Cart と Intent のどちらが主かが分かれる、というライフサイクル上の区別も仕様の中心である（`docs/specification.md` Section 5）。

#### IF 定義

AP2 の「IF」は **HTTP のパス一覧というより A2A 拡張としての契約**が主である。

* **AgentCard 拡張**: 拡張 URI と `roles`（merchant / shopper / credentials-provider / payment-processor）を `params` に載せる JSON Schema が `docs/a2a-extension.md` に定義されている。
* **メッセージ・アーティファクト**: `IntentMandate` は A2A `Message` の DataPart、`CartMandate` は `Artifact` の DataPart としてプロファイル化されている。

**MCP** については、Merchant / MPP を **「MCP endpoint または AI Agent」** とする記述や、**MCP 向け参照実装を追う**旨が `docs/specification.md` にある一方、**v0.1 の技術実装セクションは A2A 前提のシーケンス**が中心である（Section 7）。**MCP 専用のメッセージスキーマ一覧**は、少なくともミラー内容からは **A2A ほど明示的ではない**。

#### 認証認可

「認証認可」は **OAuth 一発の API 仕様**という形ではなく、次の積み上げとして記述される。

* **Mandate の暗号署名**（ユーザ・マーチャント等の非改ざん性）
* **ロール分離**（ショッピング経路と PCI/PII を扱う CP の分離）（`docs/topics/privacy-and-security.md`）
* **短期の信頼**としての **手動キュレーションされたレジストリ／許可リスト**（`docs/specification.md` Section 3.2.1）
* **長期**として **HTTPS、DNS、mTLS、API キー交換**等への期待（Section 3.2.2）
* **ステップアップチャレンジ**（3DS2、OTP 等）と **v0.1 でのリダイレクトチャレンジ**（Section 5.5）

つまり **「API のスコープトークン」より「意図の VDC と既存決済インフラのチャレンジ」**が主役である。

### 個別調査トピック

#### サポートする決済手段

* **公式ロードマップ / v0.1**: **プル型（クレジット／デビット等）**が明示されている（`docs/specification.md` 冒頭ロードマップ、`docs/roadmap.md`）。
* **将来**: プッシュ型（口座振替、ウォレット等）、Human-not-present の拡張（同ロードマップ）。
* **x402 / 暗号資産**: `docs/topics/ap2-and-x402.md` で **x402 との補完**と **[a2a-x402](https://github.com/google-agentic-commerce/a2a-x402/) リポジトリとの整合予定**が述べられている。サンプルに **human-present の x402 シナリオ**（`samples/python/scenarios/a2a/human-present/x402/`）がある。
* **話題としての stablecoin**: ドキュメントに stablecoin payments のトピック追加が進んでいる旨が、GitHub 上の直近の `docs:` 系コミット／Issue と整合する（詳細はリポジトリの `docs/topics/` を追う必要あり）。

#### MCP サポートの状況

* **文書上の位置づけ**: `docs/topics/ap2-a2a-and-mcp.md` は **MCP 用サーバを開発中**と明記する。`docs/roadmap.md` では **「AP2 MCP server v0.1」が未チェック**であり、**A2A 拡張 v0.1 や各 SDK も同様に未完了**として列挙されている。
* **解釈**: MCP は **トランスポート／ツール統合の重要層**として扱われるが、**v0.1 リリースタグと同時に完了した標準成果物**というより **ロードマップ上の次のマイルストーン**に近い。

### 検討状況（Issue とリリース）

* **GitHub Releases**: 公開 API 上、**[v0.1.0（2025-09-16）](https://github.com/google-agentic-commerce/AP2/releases/tag/v0.1.0)** が最新。**本文は「Create Agent Payments Protocol (AP2)」**を主機能として挙げている。
* **CHANGELOG**: `CHANGELOG.md` も **0.1.0 のみ**で、内容は上記と一致する。
* **活発に見える open Issue（更新日ベースの抜粋）**: 仕様と実装の整合、Human-present の承認チェーン、AP2/A2A 契約層でのチャレンジフローの未定義、Mandate 周りのセキュリティ・型の不整合などを指摘する **Docs / Bug / Feat** が並んでいる（例: 「Human-present approval chain remains underdefined」「AP2 challenge flow underdefined at the AP2/A2A contract layer」など）。**依存関係バンプ**も多く、実装と仕様の両方が活発に動いている印象である。

## 未解決事項・不足情報

* **MCP**: 「MCP server v0.1」の**具体的なツール一覧・スキーマ・リリース時期**は、ロードマップとトピック文面以外の**確定ドキュメント**を本調査では深掘りしていない。
* **認証認可の細目**: mTLS やレジストリの**運用プロファイル**は長期ビジョン寄りで、**相互運用テストに落ちた規範**としては不足しうる。
* **ワークスペースミラーと GitHub の完全一致**: `references/specification/community/AP2` は**特定時点のスナップショット**であり、**本日時点の `main` との差分**は自動では検証していない。
* **決済手段の網羅表**: カード＋x402 サンプル＋ stablecoin トピック等は確認できるが、**対応表を1枚にした公式マトリクス**は未確認である。

## 次のアクション

* **ローカルミラーを更新**する場合は、`references/specification/community/AP2` を upstream の `main`（または調査対象タグ）に合わせて再取得し、本レポートの該当章を差し替える。
* **MCP 追跡**: `docs/roadmap.md` のチェックボックスと、リポジトリ内で `mcp` を検索した結果（新規 `servers/` 等の追加）を定期確認する。
* **決済手段**: `docs/topics/ap2-and-x402.md` と `a2a-x402` リポジトリの**リリース対応表**を横断し、AP2 型定義との対応を表形式で整理する。
* **議論の追従**: [AP2 Issues](https://github.com/google-agentic-commerce/AP2/issues) で **Documentation** ラベルや「underdefined」を含む項目をフィルし、仕様書の次版で解消されたかを確認する。

## 参照ファイル

* `insights/003-ap2-research/README.md`
* `references/specification/community/AP2/README.md`
* `references/specification/community/AP2/docs/specification.md`
* `references/specification/community/AP2/docs/a2a-extension.md`
* `references/specification/community/AP2/docs/topics/ap2-a2a-and-mcp.md`
* `references/specification/community/AP2/docs/topics/ap2-and-x402.md`
* `references/specification/community/AP2/docs/topics/privacy-and-security.md`
* `references/specification/community/AP2/docs/roadmap.md`
* `references/specification/community/AP2/src/ap2/types/mandate.py`
* `references/specification/community/AP2/src/ap2/types/payment_request.py`
* `references/specification/community/AP2/CHANGELOG.md`

## 主要ファクト

* **ディレクトリ**: `docs/` が仕様・MkDocs、`src/ap2/types/` が Mandate / Payment Request 系データモデル、`samples/` が言語別シナリオ（ルート `README.md` のナビゲーション記述）。
* **データモデル**: CartMandate / IntentMandate / PaymentMandate と W3C `PaymentRequest` 系オブジェクトが `docs/specification.md` と `src/ap2/types/*.py` で結びつけられている。
* **IF**: REST エンドポイント一覧ではなく、`docs/a2a-extension.md` の **AgentCard 拡張 URI・roles・A2A Message/Artifact の DataPart キー**がインタフェースの中核である。
* **認証認可**: Mandate 署名、ロール分離、許可リスト、将来の mTLS/DNS 等、および 3DS2 等のチャレンジ（`docs/specification.md` Section 3.2, 5.5、`docs/topics/privacy-and-security.md`）。
* **状態・ライフサイクル**: Human-present / not-present の違い、Intent の TTL・カート有効期限、チャレンジ時のユーザーオブザーバビリティ（`docs/specification.md` Section 5）。
* **決済手段**: v0.1 はプル型カード中心；x402 は補完関係・別実装リポジトリと明示（`docs/topics/ap2-and-x402.md`）；サンプルに x402 シナリオディレクトリあり。
* **MCP**: トピック文面とロードマップに **AP2 MCP server v0.1（未チェック）**；仕様本文は A2A 実装例が先行。
* **リリース**: GitHub 上 **v0.1.0（2025-09-16）** が最新リリース、`CHANGELOG.md` も同内容。
* **GitHub 上の議論（API より）**: 文書の未定義箇所（Human-present 承認チェーン、AP2/A2A 境界のチャレンジ）に関する Issue が 2026年4月時点で更新されている。
