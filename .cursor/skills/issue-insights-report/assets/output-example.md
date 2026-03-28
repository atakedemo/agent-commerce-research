# 調査レポート

## 対象Issue

- Issue: `owner/repo#123`
- タイトル: `Issue title`
- 概要: Issue description の要点を 2-3 文で整理する

## エグゼクティブサマリー

Issue で求められている論点に対して、`insights/example-topic` 配下の情報から何が言えるかを短くまとめる。

## 分析

Issue の論点と `insights/example-topic` 配下の根拠を対応づけて、何が既に確認できていて、何がまだ断定できないかを説明する。

なお、Issue上の論点が段落によって区切られている場合は、`###` の形式で、本セクションにおいても段落を分けて記載する

Target リポジトリの Issue/PR に同種の未解決論点が継続して現れている場合は、その事実を踏まえて優先テーマや未解決事項候補を考察する。

## 主要ファクト

- `README.md` では調査対象の背景と前提条件が定義されている。
- `notes.md` には観測結果が時系列で残っている。
- `summary.json` には比較結果や件数が構造化されている。
- Target リポジトリの open Issue/PR では、関連テーマとして認証境界と役割分担が継続的に議論されている。

## 未解決事項・不足情報

- Issue description には成功条件の優先順位が明示されていない。
- `insights/example-topic` 配下に最新実行日の情報がなく、データ鮮度を断定できない。
- Target リポジトリの open Issue で関連論点が未解決のまま残っている場合は、その論点を候補として記載する。

## 調査対象ディレクトリ

- 対象: `insights/example-topic`
- 確認対象: `README.md`, `notes.md`, `summary.json`

## 次のアクション

- Issue の成功条件を追加で確認する。
- 不足している観測ログを `insights/example-topic` に追加する。
- 主要ファクトを更新したうえで `Report.md` を再生成する。

## 外部リファレンス記録

外部リファレンスを引用した場合は、`references/reference-report.md` に以下を記録する。

なお、`引用元` はリポジトリ単位または文書群単位で整理すればよく、Issue単位やPR単位での分類は不要。

- 引用したリファレンスのURL
- 対象Issue: `[Issue title](url)`
- 引用の目的（100文字以内）
