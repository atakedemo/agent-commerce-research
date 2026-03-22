# 調査レポート

## 対象Issue

- Issue: `https://github.com/atakedemo/ucp-research/issues/1`
- タイトル: `UCPの現在地とこれからの動向の予測`
- 概要: UCP が何を標準化しつつあるのか、どこまで仕様化が進んでいるのか、各プレイヤーの役割と既存システムに必要な追加機能を周辺標準も含めて整理したいという Issue。

## 調査対象ディレクトリ

- 対象: `insights/001-current-location-202603`
- 確認対象: `README.md`, 既存 `Report.md`
- `README.md` の案内に従い、`references/specification/community/ucp/` を主対象、`references/specification/community/AP2/` と `references/specification/community/A2A/` を必須参照、`references/specification/official/OpenID4VCI/`, `references/specification/official/OpenID4VP/`, `references/specification/official/digitalcredentials.dev/` を補助参照として確認した。
- 確認したファイル種別: `*.md`, `*.json`

## エグゼクティブサマリー

UCP は、AI エージェントやアプリなどの Platform、事業者、決済・資格情報提供者が商取引を共通の能力モデルで連携するためのオープン標準として整理されつつあり、仕様本文、スキーマ、OpenAPI/OpenRPC、版管理手順まで公開されているため、単なる構想段階ではなく実装可能性を意識した整備が進んでいると見てよいです。一方で、ロードマップ側では将来項目がコミットメントではないと明記されており、コミュニティ議論や未解決項目の収束状況を断定するには Issue/PR レベルの追加調査が必要です。

## Issue要約

Issue では、UCP の現在地を把握するために、まず規格が何を対象にし、どの論点がどこまで策定されているかを整理することが求められている。加えて、AI エージェントサービス事業者、EC サイト運営事業者、決済事業者の役割分担を整理し、UCP 対応で既存システムに追加が必要な機能や、関連するセキュリティ・資格情報標準を明らかにしたいとしている。参照情報として AP2、A2A、MCP、OpenID4VC、Digital Credential API が明示されている。

## 主要ファクト

- `insights/001-current-location-202603/README.md` では、主対象が `UCP`、必須参照が `AP2` と `A2A`、補助参照が `Digital Credential API` と `OID4VCI/OID4VP` と定義されている。
- `references/specification/community/ucp/README.md` と `docs/documentation/core-concepts.md` では、UCP は商取引の断片化を解消するためのオープン標準であり、Platform、Business、Credential Provider、Payment Service Provider を主要な役割として扱っている。
- `references/specification/community/ucp/docs/specification/overview.md` と `docs/versioning.md` では、公式仕様、RFC 2119 準拠の記述、日付ベースのプロトコル版管理、Tech Council 承認後のリリースブランチ運用が定義されており、仕様管理の骨格がすでに存在する。
- `references/specification/community/ucp/docs/documentation/roadmap.md` では、将来項目は透明性のために公開しているが、特定機能の提供コミットメントではないと明記されている。
- `references/specification/community/ucp/source/schemas/ucp.json`, `source/schemas/capability.json`, `source/services/shopping/rest.openapi.json`, `source/services/shopping/mcp.openrpc.json` には、能力定義、メタデータ、REST/MCP 向け機械可読仕様が含まれている。
- `references/specification/community/ucp/docs/specification/checkout.md` では、Business が Merchant of Record を担い、チェックアウト時に Payment Handler を発見し、買い手が信頼された UI で最終確定する流れが整理されている。
- `references/specification/community/A2A/docs/topics/key-concepts.md` と `docs/topics/what-is-a2a.md` では、User、Client Agent、Remote Agent、Task、Message、Artifact、Agent Card が定義されており、異なる組織のエージェント連携レイヤを担当している。
- `references/specification/community/AP2/src/ap2/types/mandate.py` と `samples/python/scenarios/a2a/human-present/cards/README.md` では、Intent、Cart、Payment の Mandate 連鎖と、Shopping、Merchant、Merchant Payment Processor、Credentials Provider の役割分離がサンプル付きで示されている。
- `references/specification/official/OpenID4VCI/1.0/openid-4-verifiable-credential-issuance-1_0.md` と `references/specification/official/OpenID4VP/1.0/openid-4-verifiable-presentations-1_0.md` では、VC の発行と提示が OAuth ベースで別プロトコルとして整理されている。
- `references/specification/official/digitalcredentials.dev/docs/intro.md` と `docs/references/related-specs.md` では、Digital Credentials API がブラウザや OS とウォレットの接点を担う実装視点の案内として位置づけられている。一方で、ローカルの `docs/issue-credential/openid4vci.md` と `docs/requesting-credential/openid4vp.md` は "Coming Soon" であり、このリポジトリ単体では詳細な実装論はまだ薄い。
- `references/specification/community/ucp/docs/specification/catalog/mcp.md`, `cart-mcp.md`, `checkout-mcp.md` と `references/specification/community/A2A/docs/topics/a2a-and-mcp.md` から、MCP は UCP 能力の提供バインディングや A2A との役割分担の文脈では確認できるが、`references/` 配下に MCP コア仕様そのものは見当たらなかった。

## 分析

Issue の「規格の策定状況」という観点に対しては、UCP はすでに概念文書だけでなく、Shopping 系能力の仕様本文、スキーマ、REST/MCP/Embedded 向けインターフェース定義を備えており、少なくとも Catalog、Cart、Checkout などの中核領域は実装可能な粒度まで具体化されていると評価できます。その一方で、ロードマップは非コミットメントであり、将来拡張や未解決項目の収束時期までは読み取れません。したがって「現在地」は、標準の骨格と主要能力はかなり具体化されているが、成熟度を最終判断するには仕様外の議論ログ確認が必要、という整理が妥当です。

Issue の「各エンティティの役割」という観点では、UCP の Platform は AI エージェントサービス事業者に、Business は EC サイト運営事業者に、PSP は決済事業者に概ね対応づけられます。さらに UCP と AP2 をあわせて見ると、Credential Provider や Payment Handler のような補助主体も重要であり、決済情報や配送先などの機微情報は事業者本体ではなく別責務として扱う構図が見えます。A2A はその上位で、エージェント同士の発見、認証、タスク継続、成果物受け渡しを司るため、UCP の商取引意味論を運ぶための連携レイヤとして理解するのが自然です。

Issue の「既存システムに対して必要となる機能群」という観点では、EC 事業者側には `/.well-known/ucp` による能力公開、Catalog/Cart/Checkout API の提供、Payment Handler 連携、認証済み UI での最終確定フロー整備が必要になります。AI エージェントサービス事業者側には、A2A もしくは MCP/REST を通じた能力発見と呼び出し、長時間タスク管理、ユーザー同意やエラー処理のオーケストレーションが求められます。決済・資格情報側には、AP2 の Mandate や OpenID4VCI/OID4VP/DC API が示すように、支払い委任や VC の発行・提示を安全に扱う境界面を実装する必要があります。つまり、UCP 対応は単一 API 追加ではなく、商取引能力、エージェント連携、資格情報・決済連携の三層をどう分担するかの設計課題として捉えるべきです。

一方で、Issue に含まれる FAPI 対応や EMVco 対応については、今回確認した `README.md` 指定参照からは直接の根拠を確認できませんでした。また、MCP については UCP の実装バインディングとしては見えるものの、コア仕様を直接確認していないため、MCP 自体のセキュリティ水準や適用範囲を断定する段階にはありません。ここは追加調査が必要です。

## 未解決事項・不足情報

- UCP コミュニティの Issue や PR を確認していないため、未解決項目がどの程度収束しそうかという「議論の勢い」はまだ評価できない。
- FAPI、EMVco について、今回の対象ディレクトリが案内する参照先には直接根拠がなく、Issue が求めるセキュリティ基準との接続は未整理である。
- `references/` 配下には MCP のコア仕様が見当たらず、MCP を独立標準としてどう評価するかは追加確認が必要である。
- Digital Credentials API のローカル資料は導入・関連仕様案内が中心で、VC 発行・提示の詳細は OpenID4VCI/OID4VP 側を主に読む必要がある。
- 既存プラットフォームの拡張で吸収できる領域と、各プレイヤーが個別実装しなければならない領域の定量的な切り分けは、今回の証拠だけではまだ不足している。

## 次のアクション

- UCP リポジトリの Issue/PR を確認し、Catalog、Cart、Checkout 以外の能力や拡張がどの程度安定しているかを追記する。
- AI エージェント事業者、EC 事業者、決済事業者、Credential Provider の責務を表形式にして、既存基盤拡張で対応可能なものと個別実装が必要なものを分けて整理する。
- FAPI、EMVco、MCP コア仕様の参照先を追加し、Issue が求めるセキュリティ要件との対応関係を補完する。
- UCP と AP2/A2A/OID4VCI/OID4VP/DC API の関係を「商取引意味論」「エージェント連携」「資格情報・提示」の三層で図示し、境界を明確にする。

## 参照ファイル

- `insights/001-current-location-202603/README.md`
- `insights/001-current-location-202603/Report.md`
- `references/specification/community/ucp/README.md`
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
- `https://github.com/atakedemo/ucp-research/issues/1`
