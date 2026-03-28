# 調査レポート

## 対象Issue

- Issue: `https://github.com/atakedemo/ucp-research/issues/1`
- タイトル: `UCPの現在地とこれからの動向の予測`
- 概要: UCP が何を定める規格で、どこまで策定が進んでいるかを整理し、AI エージェント事業者・小売事業者・決済事業者の役割分担と、既存システムに追加で必要になる機能群を整理することが求められている。加えて、コミュニティの議論状況から未解決項目の解消や仕様の詳細化が進みそうかも見たい、という依頼である。

## 調査対象ディレクトリ

- 対象: `insights/001-current-location-202603`
- 確認対象: `README.md`
- 参照起点: `README.md` の `Target` と `Must` を起点に、`references/specification/community/ucp/` を主対象、`AP2` `A2A` `MCP` と `OID4VCI` `OID4VP` `Digital Credentials API` を補助参照とした

## エグゼクティブサマリー

UCP は、少なくとも `shopping` 領域については、ディスカバリ、能力ネゴシエーション、複数トランスポート、チェックアウト/注文/ID 連携、支払いハンドラ、シグネチャまでをかなり具体的に定義し始めている。一方で、現在の中心は依然として「小売の購入フロー」であり、コミュニティでは決済手段拡張や属性連携の議論は活発だが、サービス系ユースケースや一部のコア整合性はなお進行中であるため、現時点の UCP は「広く構想済み、shopping は具体化が進行、全体はまだ draft 的に進化中」と見るのが妥当である。

## Issue要約

Issue 本文で明示されている論点は次の 3 点である。第 1 に、UCP が何を定める規格か、特にデータモデル、システム間インターフェース、認証認可、セキュリティ水準を知りたい。第 2 に、AI エージェント提供者、小売事業者、決済事業者の役割分担を整理したい。第 3 に、UCP 対応で既存システムに何を追加すべきか、また既存プラットフォームや既存規格の拡張で吸収される領域はどこかを整理したい。加えて、コミュニティの議論状況から、未解決項目が今後詰まっていきそうかも確認したい。

## 主要ファクト

- `insights/001-current-location-202603/README.md` では、調査対象を `references/specification/community/ucp/` とし、必須参照として `AP2` `A2A` `MCP`、推奨参照として `Digital Credentials API` `OID4VCI` `OID4VP` を挙げている。
- `references/specification/community/ucp/README.md` は、UCP を「commerce entities 間の interoperability を実現する open standard」と位置づけ、初期の主要 capability を `Checkout` `Identity Linking` `Order` `Payment Token Exchange` としている。
- `references/specification/community/ucp/` のリポジトリ構造は、`docs/` に人間向け仕様、`source/` に OpenAPI/OpenRPC/JSON Schema などの機械可読定義、`scripts/` に生成補助が置かれており、仕様説明と実体スキーマが分離されている。
- `references/specification/community/ucp/docs/specification/overview.md` では、`services` が `REST` `MCP` `A2A` `embedded` の 4 トランスポートを持ちうること、`capabilities` と `extensions` を profile ベースでネゴシエーションすることが定義されている。
- `references/specification/community/ucp/source/services/shopping/rest.openapi.json` には、`/checkout-sessions`、`/checkout-sessions/{id}`、`/checkout-sessions/{id}/complete`、`/checkout-sessions/{id}/cancel`、cart/session 系、order webhook 系が定義されており、少なくとも shopping ドメインの API 面は具体的に記述されている。
- `references/specification/community/ucp/docs/specification/checkout-rest.md` は、checkout の REST binding として `create/get/update/complete/cancel` を例付きで説明しており、`UCP-Agent` ヘッダ、`Idempotency-Key`、HTTP status、署名利用時の要件まで含めている。
- `references/specification/community/ucp/source/schemas/shopping/checkout.json` と `references/specification/community/ucp/docs/specification/checkout-rest.md` から、checkout は `id` を持つセッション資源として扱われ、`status` により進行状態を表し、`continue_url` を使った handoff / session recovery も前提にしていることが確認できる。
- `references/specification/community/ucp/docs/specification/order.md` と `references/specification/community/ucp/source/schemas/shopping/order.json` では、order は checkout 完了後の確定資源として扱われ、`fulfillment.expectations`、`fulfillment.events`、`adjustments` という分離で、配送期待値・実イベント・返金等の事後変化を表現している。
- `references/specification/community/ucp/docs/specification/identity-linking.md` では、`dev.ucp.common.identity_linking` を capability として定義し、主たる方式を OAuth 2.0 としつつ mechanism registry 方式で将来拡張できるようにしている。さらに scope は固定列挙ではなく、交渉で最終的に残った capability から動的導出する設計である。
- `references/specification/community/ucp/docs/documentation/core-concepts.md` では、主要参加者として `Platform` `Business` `Credential Provider` `PSP` を分けて説明しており、AI エージェント/アプリ、販売主体、資格情報保有主体、決済インフラ主体の境界を明示している。
- `references/specification/community/ucp/docs/specification/overview.md` の payment architecture は、`Business ↔ Payment Credential Provider`、`Platform ↔ Payment Credential Provider`、`Platform ↔ Business` の trust triangle を前提に、platform が生の決済情報を直接扱わない設計を推奨している。
- 同じく `overview.md` では、セキュリティ観点として HTTPS、OAuth 2.0、mTLS、HTTP Message Signatures (RFC 9421)、AP2 mandate、PCI-DSS、GDPR、signals を明示している。
- `references/specification/community/AP2/README.md` は AP2 を agent payments のサンプル/デモ群として位置づけており、UCP 側 `overview.md` でも autonomous commerce 向けの強い認可証跡として `dev.ucp.shopping.ap2_mandate` を参照しているため、UCP 単独ではなく周辺規格で強い支払い同意を補う構図が見える。
- `references/specification/community/A2A/README.md` は A2A を agent 間の相互運用プロトコルと説明し、長時間タスクや opaque agent 間連携を強みとしている。UCP 側 `overview.md` でも A2A は transport の 1 つとして扱われており、業務ドメイン規格と agent 間接続規格の責務は分離されている。
- `references/specification/community/modelcontextprotocol/README.md` は MCP を specification/schema/documentation のリポジトリとしている。UCP 側 `overview.md` では MCP を `tools/call` ベースの transport binding として使うことを定義しており、UCP は MCP の上に commerce capability を載せる位置づけである。
- `references/specification/official/OpenID4VCI/1.0/openid-4-verifiable-credential-issuance-1_0.md` は、VC 発行を OAuth 保護 API として定義している。
- `references/specification/official/OpenID4VP/1.0/openid-4-verifiable-presentations-1_0.md` は、Credential Presentation を OAuth 2.0 上に載せ、Digital Credentials API と組み合わせられると述べている。
- `references/specification/official/digitalcredentials.dev/docs/concepts/layering.md` では、Digital Credentials API は Website/Browser/OS/Credential Manager の境界をまたぐ API であり、プロトコル非依存であることが示されている。したがって、UCP が VC や wallet と連携する場合も、UCP 自身が wallet OS API を規定するのではなく既存基盤を利用する構図が自然である。
- `references/specification/community/ucp/docs/documentation/roadmap.md` では、今後の重点として `product discovery and post-order management`、`cart and basket building`、`loyalty & member benefits`、`global markets` が挙がっており、現在の shopping/checkout 中心仕様をさらに広げる意図が明記されている。
- GitHub の open PR では、`feat: add hosted checkout payment handler for Razorpay Magic Checkout`、`feat: add com.razorpay.upi UPI Intent payment handler`、`feat: add UPI Circle (delegated UPI) payment handler for agentic commerce`、`feat: add attribution extension for checkout sessions` など、決済手段・地域対応・周辺拡張の提案が並んでいる。
- GitHub の open PR `fix: allow "draft" as declared protocol version in UCP responses` は、現在の schema が `draft` 版運用を素直に表現できていないことを示しており、コアの version 表現にもなお調整余地があることを示す。
- GitHub の open Issue `[Feat]: Services Vertical — Extending UCP Beyond Physical Goods` は、現在の `dev.ucp.shopping.*` が物販に強く、サービス系取引にはそのままでは不十分だと主張している。本文には関連 discussion に maintainer response がない旨も書かれており、shopping 外拡張は未成熟な論点として読める。

## 分析

### 規格の策定状況

UCP の現在地は、「思想だけでなく、shopping 領域の具体的な IF と schema までかなり書き下ろされている段階」である。`docs/` と `source/` が分かれ、`rest.openapi.json` `mcp.openrpc.json` `embedded.openrpc.json` と JSON Schema 群が揃っているため、データモデル、操作、トランスポートの三層はすでに実装可能な粒度に近い。

一方で、成熟度は一様ではない。checkout/order/identity linking/payment architecture には具体性がある反面、`roadmap.md` が loyalty、post-order management、global markets を今後の重点としており、open PR でも payment handler や attribution のような周辺拡張が多い。つまり、コアの shopping 骨格はできつつあるが、決済手段の多様化、地域展開、周辺 capability はまだ積み上げ中である。

コミュニティの議論状況は、「進んではいそうだが、領域によって温度差がある」と読むのがよい。決済系 PR は直近で多数動いており、現実の支払い手段を取り込む方向は強く進みそうである。他方で、services vertical の open Issue が指摘するように shopping を超える一般化は未解決で、maintainer の明確な収束方向はまだ観測しにくい。

### ディレクトリ構造・IF・データモデル・状態管理の観点

ディレクトリ構造から見ると、UCP は「人間向け説明」と「機械可読な合意点」を分離して育てている。これは仕様の安定化に有利だが、逆にいえば、両者の整合がまだ変化しうることも示す。実際、open PR `fix: allow "draft" as declared protocol version in UCP responses` は、文章上の draft 概念と schema 上の表現がまだ完全には揃っていないことを示している。

IF 定義はかなり明確である。`REST` `MCP` `A2A` `embedded` の 4 transport を profile 交渉で束ね、shopping service の具体 endpoint は `rest.openapi.json` に落ちている。このため、既存システム側は「どの transport を expose するか」を選べるが、少なくとも REST と profile discovery を実装すれば最初の接続面は作りやすい。

データモデルは、checkout/order/payment/identity を capability 単位で分け、extension は `allOf` による schema composition で足す方針である。これは base schema を薄く保ちつつ、地域別決済や attribution などを後から足しやすい構造なので、今後の広がりに向く。一方で、open PR が多いという事実は、今まさに「何を base に置き、何を extension に逃がすか」を詰めている最中でもある。

状態管理は、UCP が単なる stateless API ではなく「session/lifecycle を持つ取引プロトコル」であることを示している。checkout は `create -> update -> ready_for_complete -> complete/cancel` を持ち、`continue_url` で buyer handoff や recovery を扱う。order は webhook で事後 lifecycle を送る。したがって UCP 対応では、既存 EC システムに API を増やすだけでなく、セッション継続・再開・署名付きイベント配送まで含めた状態管理が必要になる。

### 各エンティティの役割

AI エージェントサービス事業者に相当するのは UCP 上の `Platform` である。役割は、business profile の discovery、capability negotiation、必要に応じた identity linking、checkout session の開始・更新・完了、payment handler 実行である。A2A や MCP はこの platform が business とやり取りする transport 候補であり、UCP の本体ではない。

EC サイト運営事業者に相当するのは `Business` であり、Merchant of Record として在庫、価格、税、配送、注文、支払い確定責任を持つ。UCP では business が `/.well-known/ucp` を公開し、実装している services/capabilities/payment handlers を宣言し、checkout と order の authoritative state を返す。

決済事業者は UCP では単一主体ではなく、`Payment Credential Provider` と `PSP` に役割が割れている。Credential Provider は wallet/token/credential の保有・発行に寄り、PSP は認可/売上計上/精算に寄る。UCP の payment architecture は、この分離を前提に platform が raw credential を持たず、business が受け取った token や mandate を backend の PSP 接続で処理する構図を志向している。

### 既存システムに対して必要となる機能群

AI エージェント/プラットフォーム側で新たに必要なのは、business profile の取得とキャッシュ、capability intersection、schema 合成、UCP-Agent 広告、checkout/order API 呼び出し、必要なら OAuth 2.0 による identity linking、payment handler 実行、`continue_url` による buyer handoff、署名検証である。既存の agent 実装が MCP や A2A を持っていても、それだけでは足りず、commerce 用の profile/negotiation/schema 解釈層が必要になる。

小売事業者側で新たに必要なのは、`/.well-known/ucp` の公開、少なくとも checkout/order capability の API 実装、payment handler の設定公開、platform profile 取得、capability negotiation、署名鍵配布、webhook 送信、stateful な checkout/order 管理である。既存の EC バックエンドをそのまま公開するのではなく、UCP に合わせた外向きアダプタ層を載せる形になる可能性が高い。

決済事業者/資格情報側で必要なのは、UCP 本体を直接全面実装するよりも、payment handler spec や VC/credential 基盤として接続しやすい interface を提供することにある。UCP はその境界で AP2、OID4VCI、OID4VP、Digital Credentials API のような既存規格を活用する構図であり、wallet/credential OS API まで自前で定義しようとしているわけではない。

セキュリティ基準については、今回確認した UCP 本体では OAuth 2.0、RFC 8414、PKCE、RFC 9207、HTTP Message Signatures、AP2 mandate、PCI-DSS、GDPR は確認できた。一方で、Issue 例示にある FAPI や EMVCo を UCP が明示的な必須基準として採用している根拠は、今回確認した範囲では見つからなかった。そのため「将来関係しうる」ことは言えても、「現時点の UCP 要求である」とは断定できない。

## 未解決事項・不足情報

- `insights/001-current-location-202603` 配下には `README.md` 以外の観測メモや比較表がなく、今回の結論はほぼ参照仕様と GitHub 議論に依存している。
- UCP の reviewed files では、FAPI や EMVCo を必須セキュリティ要件として明示した根拠を確認できなかった。
- identity linking は OAuth 2.0 前提までかなり書かれているが、VC をどこまで UCP コアとして標準化するかは、AP2/OID4VCI/OID4VP/DC API への依存関係を含めてまだ境界が揺れている。
- shopping 以外の vertical については、open Issue で拡張要望がある一方、maintainer の明確な収束方針までは確認できていない。
- open PR が多く、しかも決済手段・version 表現・attribution など比較的コアに近い論点を含むため、短期的に schema や推奨実装パターンが変わる可能性がある。

## 次のアクション

- UCP を導入観点で読むなら、まず `Platform` `Business` `Credential Provider/PSP` の 3 境界ごとに、自社既存機能を `discovery/negotiation` `checkout/order` `payment/credential` にマッピングする。
- セキュリティ整理を深めるなら、今回未確認だった `FAPI` `EMVCo` を UCP issue/discussion と外部ハンドラ仕様まで広げて再調査する。
- 実装影響を見積もるなら、`rest.openapi.json` と `checkout.json` `order.json` を基準に、既存 EC API との差分一覧を別紙で作る。
- 将来性を追うなら、UCP 本家の open PR のうち payment handler 群、`draft` version 修正、services vertical 提案を継続ウォッチ対象にする。

## 参照ファイル

- `insights/001-current-location-202603/README.md`
- `references/specification/community/ucp/README.md`
- `references/specification/community/ucp/docs/documentation/core-concepts.md`
- `references/specification/community/ucp/docs/specification/overview.md`
- `references/specification/community/ucp/docs/specification/checkout-rest.md`
- `references/specification/community/ucp/docs/specification/order.md`
- `references/specification/community/ucp/docs/specification/identity-linking.md`
- `references/specification/community/ucp/docs/documentation/roadmap.md`
- `references/specification/community/ucp/source/services/shopping/rest.openapi.json`
- `references/specification/community/ucp/source/schemas/shopping/checkout.json`
- `references/specification/community/ucp/source/schemas/shopping/order.json`
- `references/specification/community/AP2/README.md`
- `references/specification/community/A2A/README.md`
- `references/specification/community/modelcontextprotocol/README.md`
- `references/specification/official/OpenID4VCI/1.0/openid-4-verifiable-credential-issuance-1_0.md`
- `references/specification/official/OpenID4VP/1.0/openid-4-verifiable-presentations-1_0.md`
- `references/specification/official/digitalcredentials.dev/docs/intro.md`
- `references/specification/official/digitalcredentials.dev/docs/concepts/layering.md`
- `references/specification/official/digitalcredentials.dev/docs/requesting-credential/dc-api.md`
- `https://github.com/Universal-Commerce-Protocol/ucp/issues`
- `https://github.com/Universal-Commerce-Protocol/ucp/pulls`
