---
name: issue-insights-report
description: Generate an investigation report from a specified GitHub Issue description and a target directory under `insights/`. Use when the user asks for a report, analysis, investigation summary, or findings based on a GitHub Issue and files in `insights/`.
---

# Issue Insights Report

## Goal

Read a specified GitHub Issue and a specified directory under `insights/`, then write:

- `<target_insight_dir>/Report.md`

## Required inputs

Before starting, confirm both of the following are available:

1. `issue_reference`
   - A GitHub Issue URL, or `owner/repo#123`
2. `target_insight_dir`
   - Exactly one directory under `insights/`

If either is missing, ask before proceeding.

## How to collect Issue information

Use GitHub data as the source of truth for the problem statement.

- If the user provides `owner/repo#123`, use `gh issue view 123 --repo owner/repo`
- If the user provides a GitHub Issue URL, use `gh issue view <url>`
- Capture at least:
  - Issue title
  - Issue body / description
- Do not invent acceptance criteria that are not present in the Issue

## How to inspect the target directory

Within `<target_insight_dir>`, prioritize:

- `<target_insight_dir>/README.md`
- `*.md`
- `*.json`
- `*.yaml`, `*.yml`
- `*.csv`
- `*.txt`
- files that look like notes, logs, summaries, analysis output, or evidence

Ignore generated content, cache directories, and unrelated binaries unless they are clearly needed.

## How to use `README.md` as the reference index

Treat `<target_insight_dir>/README.md` as the control file for reference lookup.

1. Read `README.md` before inspecting other reference sources
2. If `README.md` contains these sections, use this priority:
   - `Target`
   - `Must`
   - `Should`
   - `May`
3. Interpret the sections as follows:
   - `Target`: the repository or source that is the direct investigation subject
   - `Must`: references that must be consulted
   - `Should`: references that should be consulted when building context or support
   - `May`: optional references to consult only when the available evidence still looks insufficient
4. If `README.md` points to reference repositories or documents, follow that guidance before expanding to other sources
5. If you use a source that is not listed in `README.md`, explain why it was necessary

## How to record reference citations

If you cite any reference repository or reference document during the investigation, record it in:

- `references/reference-report.md`

For each citation, append one flat record that includes at least:

- Issue URL
- citation purpose within 100 Japanese characters

Use a simple Markdown table or bullet format, but keep the fields explicit.

Use the lookup reminders in [references/reference.md](references/reference.md).
Use the output contract in [assets/output-example.md](assets/output-example.md).

## Writing rules

- Base every claim on either the Issue description or files inside `<target_insight_dir>`
- Distinguish clearly between:
  - facts observed in the Issue
  - facts observed in the directory
  - interpretation or implications
- When evidence is weak or missing, say so explicitly
- Prefer concise Japanese prose over long bullet dumps
- Name concrete files in `## 参照ファイル`
- If `Report.md` already exists, replace it with an updated version rather than appending fragments
- If external references were cited, also update `references/reference-report.md`

## Required structure

The report must contain all of the following sections:

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

## Section expectations

### `## 対象Issue`

Include:

- Issue reference
- Issue title
- a short restatement of the Issue description

### `## 調査対象ディレクトリ`

Include:

- normalized target directory path
- what kinds of files were examined

### `## エグゼクティブサマリー`

Write a short paragraph summarizing the most important conclusion.

### `## Issue要約`

Summarize only what is stated in the Issue description:

- problem or request
- expected outcome if stated
- constraints or open points if stated

### `## 主要ファクト`

Organize findings as flat bullets. Each bullet should connect evidence to an observation.

### `## 分析`

Explain what the observed facts imply for the Issue. This is where synthesis belongs.

### `## 未解決事項・不足情報`

List missing evidence, ambiguities, or data gaps that block a stronger conclusion.

### `## 次のアクション`

List practical next steps. Keep them actionable and derived from the findings.

### `## 参照ファイル`

List the concrete files or directories used as evidence.

## Final checklist

Before finishing, verify:

- the target path is under `insights/`
- the output path is exactly `<target_insight_dir>/Report.md`
- all required sections exist
- the Issue summary is based on the real Issue body
- the analysis references evidence from the target directory
- missing information is called out explicitly
- any cited reference repositories are logged in `references/reference-report.md`
