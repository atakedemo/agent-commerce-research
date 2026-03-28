# 調査レポート

## 対象Issue

- Issue: `https://github.com/atakedemo/ucp-research/issues/1`
- タイトル: `UCPの現在地とこれからの動向の予測`
- 概要: UCP が何を定める規格か、どこまで策定が進んでいるか、AI エージェント事業者・EC 事業者・決済事業者の役割、既存システムに追加が必要な機能や関連標準を整理したいという Issue。

## 調査対象ディレクトリ

- 対象: `insights/001-current-location-202603`
- 確認対象: `README.md`, `*.md`, `*.json`
- `README.md` の案内に従い、`references/specification/community/ucp/` を主対象、`references/specification/community/AP2/`、`references/specification/community/A2A/`、`references/specification/community/modelcontextprotocol/` を必須参照、`references/specification/official/OpenID4VCI/`, `references/specification/official/OpenID4VP/`, `references/specification/official/digitalcredentials.dev/` を補助参照として確認した。
- `Target` が GitHub リポジトリであるため、`Universal-Commerce-Protocol/ucp` の関連 Issue/PR も追加で確認した。
- 確認したファイル種別: `*.md`, `*.json`

## エグゼクティブサマリー

UCP は、商取引能力、エージェント連携、決済・資格情報連携を分離して相互運用させるための仕様として、能力モデル、スキーマ、REST/MCP/A2A バインディング、版管理まで公開されており、中核部分は実装可能な粒度まで進んでいます。一方で、UCP リポジトリの open Issue/PR を見ると、`/.well-known/ucp` の versioning、wallet attestation、platform-auth 付き order 取得などはまだ進行中であり、現在地は「骨格はかなり固まっているが、認証境界や拡張能力の詳細は活発に更新中」と整理するのが妥当です。

## Issue要約

Issue では、UCP が何を定める規格で、どこまで仕様化が進んでいるかを整理することが求められている。あわせて、AI エージェントサービス事業者、EC サイト運営事業者、決済事業者の役割を整理し、UCP 対応で追加が必要な機能や、FAPI・EMVco を含むセキュリティや資格情報関連標準との関係も把握したいとしている。参照情報として AP2、A2A、MCP、OpenID4VC、Digital Credential API が列挙されている。

## 主要ファクト

- `insights/001-current-location-202603/README.md` では、主対象が `UCP`、必須参照が `AP2`、`A2A`、`MCP`、補助参照が `Digital Credential API` と `OID4VCI/OID4VP` と定義されている。
- `references/specification/community/ucp/docs/documentation/core-concepts.md` では、UCP は多様な commerce entities 間の通信と相互運用を実現する open standard と説明され、Platform、Business、Credential Provider、Payment Service Provider を主要な役割として扱っている。
- `references/specification/community/ucp/docs/specification/overview.md` と `docs/versioning.md` では、公式仕様、RFC 2119 準拠の記述、日付ベースのプロトコル版管理、Tech Council 承認後のリリースブランチ運用が定義されており、仕様管理の骨格がすでに存在する。
- `references/specification/community/ucp/docs/documentation/roadmap.md` では、将来項目は透明性のために公開しているが、特定機能の提供コミットメントではないと明記されている。
- `references/specification/community/ucp/docs/specification/overview.md` では、`/.well-known/ucp` による発見、reverse-domain の capability 命名、REST/OpenAPI・MCP/OpenRPC・A2A Agent Card・Embedded/OpenRPC の各サービス定義が示されている。
- `references/specification/community/ucp/source/schemas/ucp.json`, `source/schemas/capability.json`, `source/services/shopping/rest.openapi.json`, `source/services/shopping/mcp.openrpc.json` には、能力定義、メタデータ、REST/MCP 向け機械可読仕様が含まれている。
- `references/specification/community/ucp/docs/specification/checkout.md` では、Business が Merchant of Record を担い、Payment Handler を `/.well-known/ucp` から発見し、通常は trusted UI で買い手が最終確定する前提が示されている。
- `references/specification/community/A2A/docs/topics/key-concepts.md` と `docs/topics/what-is-a2a.md` では、User、Client Agent、Remote Agent、Task、Message、Artifact、Agent Card が定義されており、異なる組織のエージェント連携レイヤを担当している。
- `references/specification/community/AP2/src/ap2/types/mandate.py` と `samples/python/scenarios/a2a/human-present/cards/README.md` では、Intent、Cart、Payment の Mandate 連鎖と、Shopping、Merchant、Merchant Payment Processor、Credentials Provider の役割分離がサンプル付きで示されている。
- `references/specification/community/modelcontextprotocol/README.md` と `docs/docs/learn/architecture.mdx` では、MCP は host-client-server の構成を取り、JSON-RPC ベースで tools、resources、prompts をやり取りする protocol for context exchange と整理されている。
- `references/specification/official/OpenID4VCI/1.0/openid-4-verifiable-credential-issuance-1_0.md` では、VC issuance が OAuth-protected API として定義され、Wallet が OAuth 2.0 Client、Credential Issuer が Resource Server として整理されている。
- `references/specification/official/OpenID4VP/1.0/openid-4-verifiable-presentations-1_0.md` では、VC presentation が OAuth 2.0 上の仕組みとして定義され、Digital Credentials API と組み合わせる利用形態も明示されている。
- `references/specification/official/digitalcredentials.dev/docs/intro.md` では、Digital Credentials API が VC の issuance と presentation を実装する開発者向け資源として位置づけられている。一方で、`docs/issue-credential/openid4vci.md` と `docs/requesting-credential/openid4vp.md` は "Coming Soon" であり、ここ単体では仕様詳細は薄い。
- `references/specification/community/A2A/docs/topics/a2a-and-mcp.md` と `references/specification/community/ucp/docs/specification/catalog/mcp.md` から、MCP は agent-to-tool、A2A は agent-to-agent の補完関係にあり、UCP は MCP を能力提供バインディングの一つとして扱っている。
- `https://github.com/Universal-Commerce-Protocol/ucp/issues/273` では、`/.well-known/ucp` における `supported_versions` と capability/extension version の組み合わせが実装時に複雑化しうる点が open issue として残っている。
- `https://github.com/Universal-Commerce-Protocol/ucp/issues/287` と `https://github.com/Universal-Commerce-Protocol/ucp/pull/264`、`https://github.com/Universal-Commerce-Protocol/ucp/pull/280` では、wallet attestation と eligibility attestation が新しい identity / eligibility の重要テーマとして議論されており、いずれも 2026-03 時点で open のままである。
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/276` では、platform-auth を伴う order 取得 API が open PR として提案されており、order 参照時の認証境界がまだ確定途中であることが分かる。
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/272` では、Embedded Checkout Protocol に `ec.totals.change` を追加する変更が 2026-03-27 に merged されており、埋め込み UI まわりのイベントモデルが実際に拡張され続けている。

## 分析

### 規格の策定状況

UCP は、概念説明だけでなく、発見方法、能力命名、交渉方式、サービス定義、版管理、Shopping 系の機械可読仕様まで揃っているため、少なくとも中核部分は「設計メモ」ではなく実装前提の仕様として整備が進んでいます。特に `/.well-known/ucp`、capability schema、REST/MCP/A2A の並立は、異なる接続形態を同じ能力モデルで扱おうとしていることを示しています。

一方で、ロードマップは将来方針の提示に留まり、特定機能の提供時期や確定性は明言していません。加えて、UCP リポジトリの open issue #273 が versioning と discovery の複雑さを指摘し、open issue #287 と open PR #264/#280 が wallet attestation と eligibility attestation を提案し、open PR #276 が order 取得時の認証境界を詰めていることから、仕様の主戦場はすでに「基本概念」よりも「運用時の境界条件と拡張の詰め」に移っています。したがって現在地としては「主要な骨格はかなり具体化されているが、実運用に直結する境界面は活発に更新中」と評価するのが妥当です。

### 各エンティティの役割

UCP の Platform は、Issue における AI エージェントサービス事業者にほぼ対応し、ビジネス能力の発見、チェックアウト開始、ユーザー向け UI や会話体験の提供を担います。Business は EC 事業者に対応し、Merchant of Record として在庫、価格、税、注文責任、決済処理の主導権を持ちます。PSP は決済事業者に対応し、承認、売上確定、精算などの金融処理を担当します。

さらに、UCP と AP2 をあわせて見ると、Credential Provider は独立した重要主体です。決済手段や住所などの機微データを保持し、Platform や Merchant に生データを持たせない設計が意図されています。A2A はこれらの主体同士が状態を持つタスクとして連携するためのレイヤであり、MCP は個別ツールや文脈資源への接続レイヤです。つまり、UCP が商取引意味論、A2A が主体間協調、MCP がツール接続、OpenID4VCI/OID4VP/DC API が資格情報境界を担う分担が見えてきます。

### 既存のシステムに対して必要となる機能群

EC 事業者側では、`/.well-known/ucp` の公開、Catalog/Cart/Checkout 能力の API 提供、Payment Handler の公開、buyer handoff を伴う trusted UI の用意が必要になります。単に API を追加するだけでなく、UCP の capability negotiation とエラー処理モデルに沿って既存注文基盤を接続する必要があります。

AI エージェント事業者側では、事業者能力の発見、A2A または MCP/REST での呼び出し、長時間タスク管理、エスカレーション時のユーザー引き継ぎ、複数能力のオーケストレーションが必要です。決済・資格情報側では、AP2 が示す Mandate 連鎖や、OpenID4VCI/OID4VP/DC API が示す VC の発行・提示境界を実装し、本人同意・保有証明・提示を安全に扱う必要があります。

加えて、target repo の open PR 群を見ると、実装で追加が必要になる論点は静的な API 提供に留まりません。`#276` の platform-auth は order 参照の認可境界、`#264` と `#280` の attestation は eligibility / identity の検証境界、`#272` の embedded checkout event は埋め込み UI の状態同期境界に対応しています。このため UCP 対応は、EC サイト単独の改修ではなく、商取引能力、エージェント間連携、資格情報・決済連携、そして UI/認証境界まで含めた再設計になると考えるべきです。Issue で挙げられた FAPI や EMVco は、この認証・決済境界をさらに補強する候補ですが、今回の参照範囲からは直接の根拠を確認できていません。

## 未解決事項・不足情報

- `/.well-known/ucp` と capability/extension version の関係は、UCP issue `#273` が示す通り、実装上の整理がまだ十分に腹落ちしていない可能性がある。
- FAPI、EMVco について、今回の対象ディレクトリが案内する参照先には直接根拠がなく、Issue が求めるセキュリティ基準との接続は未整理である。
- wallet attestation と eligibility attestation は UCP issue `#287` と PR `#264` / `#280` で提案中だが、まだ open であり、identity / eligibility の標準化範囲は確定していない。
- order 取得時の platform-auth 境界は PR `#276` が open であり、Platform がどこまで注文情報へアクセスできるかの標準的扱いは継続議論中である。
- Digital Credentials API のローカル資料は導入と参照案内が中心で、VC 発行・提示の詳細は OpenID4VCI/OID4VP 側に依存している。
- 既存プラットフォームの拡張で吸収できる領域と、各プレイヤーが個別実装しなければならない領域の定量的な切り分けは、今回の証拠だけではまだ不足している。

## 次のアクション

- UCP リポジトリの Issue/PR を確認し、Catalog、Cart、Checkout 以外の能力や拡張がどの程度安定しているかを追記する。
- AI エージェント事業者、EC 事業者、決済事業者、Credential Provider の責務を表形式にして、既存基盤拡張で対応可能なものと個別実装が必要なものを分けて整理する。
- FAPI、EMVco、MCP コア仕様の参照先を追加し、Issue が求めるセキュリティ要件との対応関係を補完する。
- UCP と AP2/A2A/OID4VCI/OID4VP/DC API の関係を「商取引意味論」「エージェント連携」「資格情報・提示」の三層で図示し、境界を明確にする。

## 参照ファイル

- `insights/001-current-location-202603/README.md`
- `references/specification/community/ucp/docs/documentation/core-concepts.md`
- `references/specification/community/ucp/docs/documentation/roadmap.md`
- `references/specification/community/ucp/docs/versioning.md`
- `references/specification/community/ucp/docs/specification/overview.md`
- `references/specification/community/ucp/docs/specification/checkout.md`
- `references/specification/community/ucp/docs/specification/catalog/mcp.md`
- `references/specification/community/ucp/docs/specification/cart-mcp.md`
- `references/specification/community/ucp/docs/specification/checkout-mcp.md`
- `references/specification/community/ucp/source/schemas/ucp.json`
- `references/specification/community/ucp/source/schemas/capability.json`
- `references/specification/community/ucp/source/services/shopping/rest.openapi.json`
- `references/specification/community/ucp/source/services/shopping/mcp.openrpc.json`
- `references/specification/community/A2A/docs/topics/what-is-a2a.md`
- `references/specification/community/A2A/docs/topics/key-concepts.md`
- `references/specification/community/A2A/docs/topics/a2a-and-mcp.md`
- `references/specification/community/AP2/README.md`
- `references/specification/community/AP2/src/ap2/types/mandate.py`
- `references/specification/community/AP2/samples/python/scenarios/a2a/human-present/cards/README.md`
- `references/specification/community/modelcontextprotocol/README.md`
- `references/specification/community/modelcontextprotocol/docs/docs/learn/architecture.mdx`
- `references/specification/official/OpenID4VCI/1.0/openid-4-verifiable-credential-issuance-1_0.md`
- `references/specification/official/OpenID4VP/1.0/openid-4-verifiable-presentations-1_0.md`
- `references/specification/official/digitalcredentials.dev/docs/intro.md`
- `references/specification/official/digitalcredentials.dev/docs/references/related-specs.md`
- `references/specification/official/digitalcredentials.dev/docs/issue-credential/openid4vci.md`
- `references/specification/official/digitalcredentials.dev/docs/requesting-credential/openid4vp.md`
- `https://github.com/atakedemo/ucp-research/issues/1`
- `https://github.com/Universal-Commerce-Protocol/ucp/issues/273`
- `https://github.com/Universal-Commerce-Protocol/ucp/issues/287`
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/264`
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/272`
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/276`
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/280`
