# 調査レポート

## 対象Issue

- Issue: `https://github.com/atakedemo/ucp-research/issues/1`
- タイトル: `UCPの現在地とこれからの動向の予測`
- 概要: UCP が何を定める規格か、どこまで策定が進んでいるか、AI エージェント事業者・EC 事業者・決済事業者の役割、既存システムに追加が必要な機能や関連標準を整理したいという Issue。

## 調査対象ディレクトリ

- 対象: `insights/001-current-location-202603`
- 確認対象: `README.md`, `*.md`, `*.json`
- `README.md` の案内に従い、`references/specification/community/ucp/` を主対象、`references/specification/community/AP2/` と `references/specification/community/A2A/` を必須参照、`references/specification/official/OpenID4VCI/`, `references/specification/official/OpenID4VP/`, `references/specification/official/digitalcredentials.dev/` を補助参照として確認した。
- `Target` に対応する UCP リポジトリの open Issue/PR も確認し、現在の優先テーマと未解決候補を補助証拠として扱った。
- 確認したファイル種別: `*.md`, `*.json`

## エグゼクティブサマリー

UCP は、Platform、Business、Credential Provider、PSP を前提に商取引の相互運用を定義するオープン標準で、能力定義、スキーマ、REST/MCP/A2A などのバインディング、版管理方針まで公開されており、主要な骨格はかなり具体化されています。一方で、将来項目はロードマップ上で非コミットメントとされており、未解決論点の収束や FAPI/EMVco との接続までは今回の参照範囲だけでは断定できません。

## Issue要約

Issue では、UCP が何を定める規格で、どこまで仕様化が進んでいるかを整理することが求められている。あわせて、AI エージェントサービス事業者、EC サイト運営事業者、決済事業者の役割を整理し、UCP 対応で追加が必要な機能や、FAPI・EMVco を含むセキュリティや資格情報関連標準との関係も把握したいとしている。参照情報として AP2、A2A、MCP、OpenID4VC、Digital Credential API が列挙されている。

## 主要ファクト

- `insights/001-current-location-202603/README.md` では、主対象が `UCP`、必須参照が `AP2` と `A2A`、補助参照が `Digital Credential API` と `OID4VCI/OID4VP` と定義されている。
- `references/specification/community/ucp/docs/documentation/core-concepts.md` では、UCP は多様な commerce entities 間の通信と相互運用を実現する open standard と説明され、Platform、Business、Credential Provider、Payment Service Provider を主要な役割として扱っている。
- `references/specification/community/ucp/docs/specification/overview.md` と `docs/versioning.md` では、公式仕様、RFC 2119 準拠の記述、日付ベースのプロトコル版管理、Tech Council 承認後のリリースブランチ運用が定義されており、仕様管理の骨格がすでに存在する。
- `references/specification/community/ucp/docs/documentation/roadmap.md` では、将来項目は透明性のために公開しているが、特定機能の提供コミットメントではないと明記されている。
- `references/specification/community/ucp/docs/specification/overview.md` では、`/.well-known/ucp` による発見、reverse-domain の capability 命名、REST/OpenAPI・MCP/OpenRPC・A2A Agent Card・Embedded/OpenRPC の各サービス定義が示されている。
- `references/specification/community/ucp/source/schemas/ucp.json`, `source/schemas/capability.json`, `source/services/shopping/rest.openapi.json`, `source/services/shopping/mcp.openrpc.json` には、能力定義、メタデータ、REST/MCP 向け機械可読仕様が含まれている。
- `references/specification/community/ucp/docs/specification/checkout.md` では、Business が Merchant of Record を担い、Payment Handler を `/.well-known/ucp` から発見し、通常は trusted UI で買い手が最終確定する前提が示されている。
- `references/specification/community/A2A/docs/topics/key-concepts.md` と `docs/topics/what-is-a2a.md` では、User、Client Agent、Remote Agent、Task、Message、Artifact、Agent Card が定義されており、異なる組織のエージェント連携レイヤを担当している。
- `references/specification/community/AP2/src/ap2/types/mandate.py` と `samples/python/scenarios/a2a/human-present/cards/README.md` では、Intent、Cart、Payment の Mandate 連鎖と、Shopping、Merchant、Merchant Payment Processor、Credentials Provider の役割分離がサンプル付きで示されている。
- `references/specification/official/OpenID4VCI/1.0/openid-4-verifiable-credential-issuance-1_0.md` では、VC issuance が OAuth-protected API として定義され、Wallet が OAuth 2.0 Client、Credential Issuer が Resource Server として整理されている。
- `references/specification/official/OpenID4VP/1.0/openid-4-verifiable-presentations-1_0.md` では、VC presentation が OAuth 2.0 上の仕組みとして定義され、Digital Credentials API と組み合わせる利用形態も明示されている。
- `references/specification/official/digitalcredentials.dev/docs/intro.md` では、Digital Credentials API が VC の issuance と presentation を実装する開発者向け資源として位置づけられている。一方で、`docs/issue-credential/openid4vci.md` と `docs/requesting-credential/openid4vp.md` は "Coming Soon" であり、ここ単体では仕様詳細は薄い。
- `references/specification/community/A2A/docs/topics/a2a-and-mcp.md` と `references/specification/community/ucp/docs/specification/catalog/mcp.md` から、MCP は agent-to-tool、A2A は agent-to-agent の補完関係にあり、UCP は MCP を能力提供バインディングの一つとして扱っている。
- UCP リポジトリの open Issue `#273` では、`/.well-known/ucp` と `supported_versions` の扱いについて、UCP version、capability version、extension version の組み合わせが複雑化しうる点が未解決の問いとして残っている。
- UCP リポジトリの open Issue `#287` と open PR `#264`, `#280` では、wallet attestation、eligibility attestation、identity mechanism を追加する提案が進んでおり、認証・資格情報境界の詳細化が現在の活発なテーマになっている。
- UCP リポジトリの open PR `#276` では、Order 取得に `platform-auth` を導入し、「誰が認証されるべきか」「何にアクセスできるか」「いつデータを返せるか」を整理しようとしている。
- UCP リポジトリの open PR `#272` では、Embedded Checkout Protocol に `ec.totals.change` を加え、税・手数料・非同期更新に伴う totals-only change をホストへ伝える必要が議論されている。

## 分析

### 規格の策定状況

UCP は、概念説明だけでなく、発見方法、能力命名、交渉方式、サービス定義、版管理、Shopping 系の機械可読仕様まで揃っているため、少なくとも中核部分は「設計メモ」ではなく実装前提の仕様として整備が進んでいます。特に `/.well-known/ucp`、capability schema、REST/MCP/A2A の並立は、異なる接続形態を同じ能力モデルで扱おうとしていることを示しています。

一方で、open Issue `#273` が示すように、discovery/versioning の運用にはまだ解釈余地があり、仕様の柔軟性がそのまま実装上の複雑さにもつながっています。また、open PR `#272` や `#276` が checkout/order のイベントや認証境界を継続的に補っていることからも、主要領域は動いているが細部はまだ詰めている段階だと読めます。したがって現在地としては「主要な骨格はかなり具体化されているが、運用詳細や一部能力の境界はなお活発に整理中」と評価するのが妥当です。

### 各エンティティの役割

UCP の Platform は、Issue における AI エージェントサービス事業者にほぼ対応し、ビジネス能力の発見、チェックアウト開始、ユーザー向け UI や会話体験の提供を担います。Business は EC 事業者に対応し、Merchant of Record として在庫、価格、税、注文責任、決済処理の主導権を持ちます。PSP は決済事業者に対応し、承認、売上確定、精算などの金融処理を担当します。

さらに、UCP と AP2 をあわせて見ると、Credential Provider は独立した重要主体です。決済手段や住所などの機微データを保持し、Platform や Merchant に生データを持たせない設計が意図されています。加えて open Issue `#287` と PR `#264` / `#280` は、wallet attestation や eligibility attestation を通じて、資格情報提供者や第三者検証者の役割をより明示的に取り込もうとしていることを示しています。A2A はこれらの主体同士が状態を持つタスクとして連携するためのレイヤであり、UCP の意味論を運ぶ通信・協調基盤として位置づけられます。

### 既存のシステムに対して必要となる機能群

EC 事業者側では、`/.well-known/ucp` の公開、Catalog/Cart/Checkout 能力の API 提供、Payment Handler の公開、buyer handoff を伴う trusted UI の用意が必要になります。単に API を追加するだけでなく、UCP の capability negotiation とエラー処理モデルに沿って既存注文基盤を接続する必要があります。

AI エージェント事業者側では、事業者能力の発見、A2A または MCP/REST での呼び出し、長時間タスク管理、エスカレーション時のユーザー引き継ぎ、複数能力のオーケストレーションが必要です。open PR `#276` が order retrieval に `platform-auth` を足していることは、こうしたプラットフォーム側認証とアクセス制御がまだ追加整備中であることを示しています。決済・資格情報側では、AP2 が示す Mandate 連鎖や、OpenID4VCI/OID4VP/DC API が示す VC の発行・提示境界を実装し、本人同意・保有証明・提示を安全に扱う必要があります。

このため UCP 対応は、EC サイト単独の改修ではなく、商取引能力、エージェント間連携、資格情報・決済連携の三層をどこが担うかを再設計する作業になります。さらに PR `#272` が示すように、embedded checkout では totals 変化の通知のような UI/イベント境界もなお拡張中です。Issue で挙げられた FAPI や EMVco は、この第三層のセキュリティ要件を詰めるうえで重要そうですが、今回の参照範囲からは直接の根拠を確認できていません。

## 未解決事項・不足情報

- UCP コミュニティの open Issue/PR は確認したが、コメントスレッド全体までは追っておらず、各論点の合意形成状況を断定するにはまだ不足がある。
- FAPI、EMVco について、今回の対象ディレクトリが案内する参照先には直接根拠がなく、Issue が求めるセキュリティ基準との接続は未整理である。
- open Issue `#273` が示す discovery/versioning の複雑さについて、最終的にどの運用指針へ収束するかはまだ不明である。
- open Issue `#287` と PR `#264` / `#280` は wallet attestation を強く押しているが、これがどの成熟段階まで進むかは未確定である。
- MCP は A2A との比較文書と UCP バインディングとしては確認できたが、MCP コア仕様自体は今回のローカル参照範囲に含まれていない。
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
- `references/specification/official/OpenID4VCI/1.0/openid-4-verifiable-credential-issuance-1_0.md`
- `references/specification/official/OpenID4VP/1.0/openid-4-verifiable-presentations-1_0.md`
- `references/specification/official/digitalcredentials.dev/docs/intro.md`
- `references/specification/official/digitalcredentials.dev/docs/references/related-specs.md`
- `references/specification/official/digitalcredentials.dev/docs/issue-credential/openid4vci.md`
- `references/specification/official/digitalcredentials.dev/docs/requesting-credential/openid4vp.md`
- `https://github.com/Universal-Commerce-Protocol/ucp/issues/273`
- `https://github.com/Universal-Commerce-Protocol/ucp/issues/287`
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/264`
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/272`
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/276`
- `https://github.com/Universal-Commerce-Protocol/ucp/pull/280`
- `https://github.com/atakedemo/ucp-research/issues/1`
