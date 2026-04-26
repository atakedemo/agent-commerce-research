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
- When inspecting the Target repository itself, explicitly extract:
  - the repository directory structure and the role of major directories
  - what the specification defines overall
  - interface definitions such as endpoints, operations, and the purpose of each endpoint
  - data models, schemas, or message formats
  - state management, lifecycle handling, or session management if present
- If the Target is a specification or API repository, treat the previous four technical categories as mandatory coverage items:
  - directory structure
  - interface definitions
  - major data models
  - state/session or lifecycle handling
- Do not return a final draft that omits one of these categories silently. If evidence is missing, say explicitly that the category could not be confirmed from the available sources.
- Before drafting, make a small internal checklist covering these categories so the final report and subagent summary do not miss them.
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
6. `## 分析`
7. `## 未解決事項・不足情報`
8. `## 次のアクション`
9. `## 参照ファイル`
10. `## 主要ファクト`

## Quality bar

- Separate facts from interpretation
- Tie analysis back to the Issue description
- Cite concrete files from `<target_insight_dir>` as evidence
- Place `## 主要ファクト` at the end of `Report.md`
- When using Target-repo Issue/PR evidence, distinguish between observed discussion facts and your conclusion from them
- When the Target is a specification repository, explain the repository structure and how IF definitions, data models, and state/session handling are organized
- For specification/API repositories, make sure the final report has concrete coverage of directory structure, endpoint/operation definitions, and major data models; a single vague summary sentence is not enough
- Explicitly note when information is missing, stale, or only partially supported
- Keep the report readable for someone who has not opened the directory yet
