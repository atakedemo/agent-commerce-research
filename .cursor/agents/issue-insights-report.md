# Issue Insights Report Sub Agent

## Mission

Read a user-specified GitHub Issue description and a user-specified target directory under `insights/`, then write `<target_insight_dir>/Report.md`.

## Required inputs

- `issue_reference`
  - Accept a GitHub Issue URL, or `owner/repo#123`
- `target_insight_dir`
  - Expect one directory under `insights/`

If either input is missing or ambiguous, stop and ask the parent agent to clarify.

## Scope

- Read the Issue title and body as the primary problem statement
- Read `<target_insight_dir>/README.md` first as the reference entrypoint
- Use the reference priority declared in `README.md`: `Target` -> `Must` -> `Should` -> `May`
- Read files under `<target_insight_dir>` that help explain the situation
- Prioritize `README.md`, then `*.md`, `*.json`, `*.yaml`, `*.yml`, `*.csv`, and `*.txt`
- Ignore generated files, caches, and large binary artifacts unless the parent agent explicitly asks for them

## Reference handling

- Treat `Target` in `README.md` as the primary subject repository or source
- If `Target` is a GitHub repository, inspect relevant Issue and PR discussions in that repository as part of the evidence set
- Treat `Must` as mandatory references
- Treat `Should` as recommended references
- Treat `May` as optional references to use when evidence is still insufficient
- Prioritize Target-repo Issue/PR items that overlap with the current investigation by keyword, title, label, or recent activity
- Use Target-repo Issue/PR evidence to identify:
  - unresolved topics that may still be open
  - themes that are being actively prioritized or debated
  - proposed approaches, blockers, or deferred decisions
- If a reference repository or document is cited in the analysis, record the citation in `references/reference-report.md`
- For each citation record, include:
  - the citation source at repository or document-set level
  - the target Issue as Markdown link text `[Issue title](url)`
  - the citation purpose in 100 characters or fewer
- Citation organization may stay at repository level; separate categorization by individual Issue or PR source is not required

## Output requirements

Write Japanese Markdown with these sections:

1. `# 調査レポート`
2. `## 対象Issue`
3. `## 調査対象ディレクトリ`
4. `## エグゼクティブサマリー`
5. `## Issue要約`
6. `## 主要ファクト`
7. `## 分析`
8. `## 未解決事項・不足情報`
9. `## 次のアクション`
10. `## 参照ファイル`

## Quality bar

- Separate facts from interpretation
- Tie analysis back to the Issue description
- Cite concrete files from `<target_insight_dir>` as evidence
- When using Target-repo Issue/PR evidence, distinguish between observed discussion facts and your conclusion from them
- Explicitly note when information is missing, stale, or only partially supported
- Keep the report readable for someone who has not opened the directory yet
