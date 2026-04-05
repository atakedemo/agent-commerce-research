# agentic-commerce-protocol — open Issues / PRs メモ

## 取得条件

- **リポジトリ**: [agentic-commerce-protocol/agentic-commerce-protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- **取得日（UTC）**: 2026-04-05
- **API**: `GET /repos/.../issues?state=open&per_page=100&sort=updated`（**PR を含む**。Issue 専用 API ではないため `pull_request` キーで判別）

## ラベル（SEP 等）について

このリポジトリで GitHub が返す **ラベル一覧** には `SEP` は存在せず、**open な Issue/PR 93 件の応答では `labels` が付いている項目は 0 件** であった（2026-04-05 時点の API 応答）。Issue 本文や CONTRIBUTING で SEP と呼ばれる提案は、**タイトル接頭辞（`SEP:` / `Issue:` 等）** で区別するのが実態に近い。

**リポジトリに定義されているラベル（API `GET .../labels` 先頭ページ）**: `bug`, `cla-signed`, `corporate-cla`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`。現状の open 件ではほぼ使われていないため、**`gh issue list --label enhancement` 等は結果 0 になりやすい**。

### `gh` が使える場合の例（将来ラベル運用が始まったら）

```bash
# ラベル名はリポジトリの命名に合わせて変更
gh issue list --repo agentic-commerce-protocol/agentic-commerce-protocol \
  --state open --limit 200 --json number,title,labels,updatedAt \
  --jq '.[] | select(.labels | map(.name) | index("enhancement"))'

gh label list --repo agentic-commerce-protocol/agentic-commerce-protocol
```

## 優先度の付け方（本リポジトリ調査用の暫定ルール）

| 優先度 | 目安 |
|--------|------|
| **P1** | チェックアウト体験・決済・カート・フィード／プロモ・同意取得など、プロダクト面の SEP / Issue が多いテーマ |
| **P2** | その他 SEP、OpenAPI／スキーマ、拡張基盤、governance 関連 |
| **P3** | typo 修正、CLA、chore 系 CI／検証 |

※ 運用上の優先度は Founding Maintainer 側のロードマップが正とする。

---

## 一覧（更新日の新しい順）

| Pri | 種別 | # | 更新(UTC日付) | タイトル |
|-----|------|---|---------------|----------|
| P1（チェックアウト／カタログ／体験） | PR | [199](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/199) | 2026-04-05 | SEP: Marketing Consent on Checkout Complete |
| P1（チェックアウト／カタログ／体験） | Issue | [195](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/195) | 2026-04-05 | Issue: Marketing Consent on Checkout Complete |
| P1（チェックアウト／カタログ／体験） | PR | [212](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/212) | 2026-04-03 | SEP: Markdown Content Specification (CommonMark) |
| P1（チェックアウト／カタログ／体験） | Issue | [211](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/211) | 2026-04-03 | SEP: Markdown Content Specification (CommonMark) |
| P1（チェックアウト／カタログ／体験） | PR | [188](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/188) | 2026-04-02 | SEP: Add Cart Capability |
| P2（その他） | PR | [193](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/193) | 2026-04-02 | fix: correct copy-paste error in Address.company description |
| P3（運用・法務） | Issue | [210](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/210) | 2026-04-01 | Corporate CLA: PayPal |
| P1（チェックアウト／カタログ／体験） | PR | [190](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/190) | 2026-04-01 | SEP: Add Product Feeds API to Agentic Commerce Protocol |
| P2（仕様・ツール・拡張基盤） | PR | [184](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/184) | 2026-03-31 | ADMIN: Add TSC Operating Model documentation |
| P3（運用・法務） | Issue | [206](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/206) | 2026-03-31 | Corporate CLA: Agentic Commerce Inc. (Catalog) |
| P2（仕様・ツール・拡張基盤） | PR | [166](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/166) | 2026-03-30 | Add on-chain eligibility discount example |
| P2（仕様・ツール・拡張基盤） | PR | [203](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/203) | 2026-03-27 | chore: OpenAPI semantic validation with swagger-parser |
| P1（チェックアウト／カタログ／体験） | PR | [198](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/198) | 2026-03-26 | SEP: Default Delivery Option Selection on Checkout Create |
| P1（チェックアウト／カタログ／体験） | PR | [200](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/200) | 2026-03-26 | SEP: Allow Fulfillment Details on Checkout Complete |
| P1（チェックアウト／カタログ／体験） | PR | [201](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/201) | 2026-03-26 | SEP: Suggested Pricing on Checkout Create |
| P1（チェックアウト／カタログ／体験） | Issue | [197](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/197) | 2026-03-25 | Issue: Suggested Pricing on Checkout Create |
| P1（チェックアウト／カタログ／体験） | Issue | [196](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/196) | 2026-03-25 | Issue: Allow Fulfillment Details on Checkout Complete |
| P1（チェックアウト／カタログ／体験） | Issue | [194](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/194) | 2026-03-25 | Issue: Default Delivery Option Selection on Checkout Create |
| P1（チェックアウト／カタログ／体験） | PR | [192](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/192) | 2026-03-24 | SEP: Add promotions API to ACP Product Feeds |
| P1（チェックアウト／カタログ／体験） | Issue | [191](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/191) | 2026-03-24 | [SEP] Promotions API |
| P1（チェックアウト／カタログ／体験） | Issue | [189](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/189) | 2026-03-24 | [SEP] Product Feeds |
| P1（チェックアウト／カタログ／体験） | Issue | [187](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/187) | 2026-03-20 | SEP: Cart Capability: Pre-Checkout Basket Building |
| P1（チェックアウト／カタログ／体験） | Issue | [135](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/135) | 2026-03-20 | [SEP][Proposal]: MCP Transport Binding for Agentic Checkout |
| P2（SEP・要レビュー） | PR | [171](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/171) | 2026-03-18 |  SEP: Store Extension for BOPIS and In-Store Shopping |
| P1（チェックアウト／カタログ／体験） | Issue | [180](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/180) | 2026-03-18 | SEP: Add Risk Context to Delegate Payment |
| P2（SEP・要レビュー） | PR | [178](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/178) | 2026-03-17 | SEP: Move extensions from capabilities to protocol |
| P2（SEP・要レビュー） | Issue | [177](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/177) | 2026-03-17 | SEP: Move Extensions to Protocol Metadata |
| P1（チェックアウト／カタログ／体験） | Issue | [170](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/170) | 2026-03-17 | SEP: Integrating Delegate Authentication with Payment Handlers |
| P2（その他） | Issue | [164](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/164) | 2026-03-02 | SEP — Time-bound offer expiry |
| P1（チェックアウト／カタログ／体験） | Issue | [109](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/109) | 2026-03-02 | [SEP][Proposal]: Extending SPT to Support Crypto Payments |
| P1（チェックアウト／カタログ／体験） | Issue | [122](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/122) | 2026-03-01 | [SEP][Proposal]: Sale Extension - Sale Pricing Context & Discount Eligibility |
| P2（SEP・要レビュー） | Issue | [124](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/124) | 2026-02-27 | [SEP][Proposal]: Consolidate DiscountDetail and AppliedDiscount |
| P2（SEP・要レビュー） | PR | [150](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/150) | 2026-02-27 | SEP: Intervention types extension for wallet handler auth flows |
| P2（SEP・要レビュー） | PR | [165](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/165) | 2026-02-27 | SEP: Time-bound offer expiry — line-item valid_until and booking semantics |
| P2（仕様・ツール・拡張基盤） | PR | [82](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/82) | 2026-02-27 | Adding Serach Product json Example |
| P1（チェックアウト／カタログ／体験） | PR | [161](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/161) | 2026-02-26 | Delegate Payment: extend Error type and code enums for 401/500/503 |
| P2（仕様・ツール・拡張基盤） | PR | [144](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/144) | 2026-02-26 | docs: document all 11 session states in RFC and schemas |
| P2（SEP・要レビュー） | PR | [125](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/125) | 2026-02-26 | SEP: Consolidate DiscountDetail and AppliedDiscount (#124) |
| P1（チェックアウト／カタログ／体験） | PR | [123](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/123) | 2026-02-26 | SEP: Sale Extension — Sale Pricing Context & Discount Eligibility |
| P1（チェックアウト／カタログ／体験） | PR | [162](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/162) | 2026-02-25 | Clarify order status semantics (shipped, fulfilled, delivered) and fulfillment options (fixes #22) |
| P2（SEP・要レビュー） | Issue | [152](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/152) | 2026-02-24 | [SEP][Proposal] Discovery Attribution Extension |
| P1（チェックアウト／カタログ／体験） | Issue | [153](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/153) | 2026-02-24 | SEP: Account-to-Account Push Payment Handler |
| P2（その他） | PR | [143](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/143) | 2026-02-24 | docs: add intervention_required to RFC error code documentation |
| P1（チェックアウト／カタログ／体験） | PR | [156](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/156) | 2026-02-24 | SEP: Payment handler for Stripe link |
| P1（チェックアウト／カタログ／体験） | PR | [45](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/45) | 2026-02-23 | Purpose: Enable hotel discovery, ranking, and live pricing hydration in OpenAI’s Agentic Commerce Protocol (ACP). |
| P1（チェックアウト／カタログ／体験） | PR | [132](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/132) | 2026-02-23 | Delegate Payment schema: RFC alignment and e‑commerce platform improvements |
| P1（チェックアウト／カタログ／体験） | PR | [111](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/111) | 2026-02-22 | SEP: Crypto Payment Method (x402-based) #109 |
| P1（チェックアウト／カタログ／体験） | PR | [30](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/30) | 2026-02-18 | Feature: add account to account payment support |
| P1（チェックアウト／カタログ／体験） | Issue | [141](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/141) | 2026-02-18 | [SEP] Stripe Link Payment Handler |
| P2（仕様・ツール・拡張基盤） | PR | [151](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/151) | 2026-02-18 | Add intent traces examples for all reason codes |
| P2（その他） | Issue | [142](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/142) | 2026-02-17 | [Feature Request] Add redirect/webview intervention types for wallet handlers |
| P2（SEP・要レビュー） | Issue | [148](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/148) | 2026-02-16 | [SEP][Proposal]: Content Citation Attribution Extension |
| P2（その他） | Issue | [147](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/147) | 2026-02-16 | stripe.com |
| P2（その他） | Issue | [146](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/146) | 2026-02-16 | stripe.com |
| P1（チェックアウト／カタログ／体験） | PR | [73](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/73) | 2026-02-15 | SEP: Recurring payment support |
| P2（SEP・要レビュー） | Issue | [136](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/136) | 2026-02-15 | [SEP][Proposal] SEP: Discovery Capabilities Endpoint |
| P2（SEP・要レビュー） | Issue | [120](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/120) | 2026-02-10 | [SEP][Proposal]: Idempotency Requirements and Guarantees |
| P1（チェックアウト／カタログ／体験） | PR | [10](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/10) | 2026-02-09 | Allow partial billing address by separating billing from fulfillment addresses |
| P2（その他） | Issue | [38](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/38) | 2026-02-09 | Question: Adding surcharging support |
| P2（その他） | Issue | [26](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/26) | 2026-02-09 | Support for market/region context (geo_availability) |
| P2（SEP・要レビュー） | Issue | [105](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/105) | 2026-02-09 | [SEP][Proposal]: Native Orders Support - Rich Post-Purchase Lifecycle Tracking |
| P2（その他） | Issue | [98](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/98) | 2026-02-06 | [Documentation] Document `intervention_required` error code |
| P2（その他） | Issue | [16](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/16) | 2026-02-06 | Bug in rfc |
| P2（その他） | Issue | [97](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/97) | 2026-02-06 | [Proposal] Specify idempotency key TTL guidance and response headers |
| P2（SEP・要レビュー） | Issue | [61](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/61) | 2026-02-06 | [SEP] [proposal]  merchant-issued gift card support as a sourceType |
| P2（その他） | Issue | [29](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/29) | 2026-02-06 | Feature Proposal: Add Webhook Event Types for Time-Sensitive Catalog Updates |
| P1（チェックアウト／カタログ／体験） | Issue | [25](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/25) | 2026-02-06 | Question: Product Feed Spec |
| P2（その他） | Issue | [5](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/5) | 2026-02-06 | Feature Request: Merchant UI Customization for Agentic Commerce Protocol |
| P2（その他） | PR | [66](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/66) | 2026-02-06 | Support Merchant 3DS Execution |
| P2（その他） | Issue | [55](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/55) | 2026-02-06 | [Feature Request & Spec Proposal] Add 3DS Authentication Flow Support |
| P1（チェックアウト／カタログ／体験） | PR | [46](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/46) | 2026-02-05 | feat: Add UPI payment method support to Agentic Commerce Protocol |
| P1（チェックアウト／カタログ／体験） | PR | [36](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/36) | 2026-02-05 | Adds product feed spec |
| P2（SEP・要レビュー） | Issue | [79](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/79) | 2026-02-05 | [SEP] [Proposal] Open Authentication Provider Model for 3DS |
| P2（仕様・ツール・拡張基盤） | PR | [21](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/21) | 2026-02-05 | fix: resolves consistency issues in spec and examples |
| P2（SEP・要レビュー） | Issue | [107](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/107) | 2026-02-05 | [SEP][Proposal]: Universal Product Types |
| P2（その他） | Issue | [96](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/96) | 2026-02-03 | [Documentation] Document all 11 session states in RFCs |
| P2（その他） | PR | [20](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/20) | 2026-01-27 | docs: add community implementation — ACP + zkML authorization |
| P1（チェックアウト／カタログ／体験） | Issue | [12](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/12) | 2026-01-08 | [Feature Request] Add Subscription & Recurring Payment Support |
| P1（チェックアウト／カタログ／体験） | Issue | [58](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/58) | 2025-12-19 | [SEP] [proposal] Delegated Apple Pay Support  |
| P1（チェックアウト／カタログ／体験） | Issue | [59](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/59) | 2025-12-19 | [SEP] [proposal]  Delegated Google Pay and Samsung Support |
| P2（SEP・要レビュー） | Issue | [60](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/60) | 2025-12-19 | [SEP] [proposal] Merchant-Defined Data Fields |
| P1（チェックアウト／カタログ／体験） | Issue | [62](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/62) | 2025-12-19 | [SEP] [proposal] Delegated Hosted Checkout SDK Provided by Merchant or Processor |
| P1（チェックアウト／カタログ／体験） | Issue | [47](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/47) | 2025-12-09 | Product Feed Spec: Support multi-location merchants via location-specific feeds |
| P1（チェックアウト／カタログ／体験） | Issue | [40](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/40) | 2025-11-08 | [Feature Request] add x402 Payment Support |
| P2（その他） | Issue | [4](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/4) | 2025-11-07 | Unclear where bearer token is obtained for Authorization header |
| P1（チェックアウト／カタログ／体験） | Issue | [39](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/39) | 2025-11-06 | Feature Request: Checkout Session Mandatory Data |
| P1（チェックアウト／カタログ／体験） | Issue | [24](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/24) | 2025-10-17 | Question: Dynamic Product Pricing and Configurable Products |
| P1（チェックアウト／カタログ／体験） | Issue | [27](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/27) | 2025-10-17 | Question: Product Feed PUSH vs PULL |
| P2（その他） | Issue | [22](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/22) | 2025-10-14 | Question: What is the diff between order statuses`fulfilled` and `shipped`? |
| P2（仕様・ツール・拡張基盤） | Issue | [23](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/23) | 2025-10-10 | Question: Support for schema.org, json-ld, and SHACL |
| P2（その他） | Issue | [19](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/19) | 2025-10-09 | [Feature Request] Support for Restaurant/Food Ordering Use Cases |
| P2（その他） | Issue | [8](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/8) | 2025-10-02 | Question: How are `items[].id` validated? |
| P2（その他） | Issue | [15](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/15) | 2025-10-02 | ACP Manifest and Agent Whitelisting Flow |

## タイトルベースの近似分類（SEP / Issue 接頭辞）

- **SEP (title)**: 42 件
- **other**: 26 件
- **PR (non-SEP title)**: 19 件
- **issue-prefixed (often pairs with SEP PR)**: 4 件
- **admin/cla**: 2 件

### SEP と思われるタイトル（`SEP:` / `[SEP]` を含む）

- [PR #199](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/199) — SEP: Marketing Consent on Checkout Complete
- [PR #212](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/212) — SEP: Markdown Content Specification (CommonMark)
- [Issue #211](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/211) — SEP: Markdown Content Specification (CommonMark)
- [PR #188](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/188) — SEP: Add Cart Capability
- [PR #190](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/190) — SEP: Add Product Feeds API to Agentic Commerce Protocol
- [PR #198](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/198) — SEP: Default Delivery Option Selection on Checkout Create
- [PR #200](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/200) — SEP: Allow Fulfillment Details on Checkout Complete
- [PR #201](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/201) — SEP: Suggested Pricing on Checkout Create
- [PR #192](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/192) — SEP: Add promotions API to ACP Product Feeds
- [Issue #191](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/191) — [SEP] Promotions API
- [Issue #189](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/189) — [SEP] Product Feeds
- [Issue #187](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/187) — SEP: Cart Capability: Pre-Checkout Basket Building
- [Issue #135](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/135) — [SEP][Proposal]: MCP Transport Binding for Agentic Checkout
- [PR #171](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/171) —  SEP: Store Extension for BOPIS and In-Store Shopping
- [Issue #180](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/180) — SEP: Add Risk Context to Delegate Payment
- [PR #178](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/178) — SEP: Move extensions from capabilities to protocol
- [Issue #177](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/177) — SEP: Move Extensions to Protocol Metadata
- [Issue #170](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/170) — SEP: Integrating Delegate Authentication with Payment Handlers
- [Issue #164](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/164) — SEP — Time-bound offer expiry
- [Issue #109](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/109) — [SEP][Proposal]: Extending SPT to Support Crypto Payments
- [Issue #122](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/122) — [SEP][Proposal]: Sale Extension - Sale Pricing Context & Discount Eligibility
- [Issue #124](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/124) — [SEP][Proposal]: Consolidate DiscountDetail and AppliedDiscount
- [PR #150](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/150) — SEP: Intervention types extension for wallet handler auth flows
- [PR #165](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/165) — SEP: Time-bound offer expiry — line-item valid_until and booking semantics
- [PR #125](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/125) — SEP: Consolidate DiscountDetail and AppliedDiscount (#124)
- [PR #123](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/123) — SEP: Sale Extension — Sale Pricing Context & Discount Eligibility
- [Issue #152](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/152) — [SEP][Proposal] Discovery Attribution Extension
- [Issue #153](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/153) — SEP: Account-to-Account Push Payment Handler
- [PR #156](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/156) — SEP: Payment handler for Stripe link
- [PR #111](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/111) — SEP: Crypto Payment Method (x402-based) #109
- [Issue #141](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/141) — [SEP] Stripe Link Payment Handler
- [Issue #148](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/148) — [SEP][Proposal]: Content Citation Attribution Extension
- [PR #73](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/pull/73) — SEP: Recurring payment support
- [Issue #136](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/136) — [SEP][Proposal] SEP: Discovery Capabilities Endpoint
- [Issue #120](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/120) — [SEP][Proposal]: Idempotency Requirements and Guarantees
- [Issue #105](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/105) — [SEP][Proposal]: Native Orders Support - Rich Post-Purchase Lifecycle Tracking
- [Issue #61](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/61) — [SEP] [proposal]  merchant-issued gift card support as a sourceType
- [Issue #79](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/79) — [SEP] [Proposal] Open Authentication Provider Model for 3DS
- [Issue #107](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/107) — [SEP][Proposal]: Universal Product Types
- [Issue #58](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/58) — [SEP] [proposal] Delegated Apple Pay Support 
- [Issue #59](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/59) — [SEP] [proposal]  Delegated Google Pay and Samsung Support
- [Issue #60](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/60) — [SEP] [proposal] Merchant-Defined Data Fields
- [Issue #62](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/issues/62) — [SEP] [proposal] Delegated Hosted Checkout SDK Provided by Merchant or Processor
