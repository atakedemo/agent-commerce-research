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
4. If `Target` is a GitHub repository, inspect not only the repository contents but also relevant Issues and PRs
5. For Target-repo Issues and PRs, prioritize items that overlap with the current investigation:
   - keyword overlap with the user-specified Issue
   - similar titles or problem statements
   - labels that indicate active design, bug, spec, roadmap, or discussion work
   - recently updated open items
6. When inspecting the Target repository itself, explicitly collect evidence for:
   - the repository's directory structure and the role of major directories
   - what the specification defines at a high level
   - interface definitions such as endpoints, operations, and the purpose of each endpoint
   - data models, schemas, or message formats
   - state management or session management, if defined
   - If the Target is a specification or API repository, do not stop at a high-level overview. Collect at least one concrete evidence item for each of the following, or explicitly record that the evidence was not found:
     - repository directory structure
     - interface definitions
     - major data models
     - state/session or lifecycle handling
   - Before writing the report, make a short evidence inventory for these categories so none of them are accidentally omitted from the final write-up
7. Use Target-repo Issue/PR evidence to strengthen:
   - likely unresolved items
   - themes currently being prioritized
   - already proposed solutions, blockers, or pending decisions
8. If `README.md` points to reference repositories or documents, follow that guidance before expanding to other sources
9. If you use a source that is not listed in `README.md`, explain why it was necessary

## How to record reference citations

If you cite any reference repository or reference document during the investigation, record it in:

- `references/reference-report.md`

For each citation, append one flat record that includes at least:

- citation source
- target Issue written as `[Issue title](url)`
- citation purpose within 100 Japanese characters

Use a simple Markdown table or bullet format, but keep the fields explicit.
Citation organization may stay at repository level. You do not need separate grouping for each cited Issue or PR.

Use the lookup reminders in [references/reference.md](references/reference.md).
Use the output contract in [assets/output-example.md](assets/output-example.md).

## Writing rules

- Base every claim on either the Issue description or files inside `<target_insight_dir>`
- Distinguish clearly between:
  - facts observed in the Issue
  - facts observed in the directory
  - facts observed in the Target repository's Issue/PR discussions
  - interpretation or implications
- When evidence is weak or missing, say so explicitly
- Prefer concise Japanese prose over long bullet dumps
- Name concrete files in `## 参照ファイル`
- If `Report.md` already exists, replace it with an updated version rather than appending fragments
- If external references were cited, also update `references/reference-report.md`
- In `references/reference-report.md`, use the column title `対象Issue` instead of `Issue URL`

## Required structure

The report must contain all of the following sections:

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

### `## 分析`

Explain what the observed facts imply for the Issue. This is where synthesis belongs.

If the Issue body itself has multiple distinct themes or paragraphs, split this section with `###` headings that mirror those themes.

When the Target is a specification repository, the analysis should explicitly explain:

- what the directory structure suggests about the repository's decomposition
- how interface definitions, data models, and state/session handling are divided across the spec
- whether these areas look mature, partial, or still evolving

If any of the above categories could not be confirmed, the analysis must say that explicitly rather than silently omitting the category.

When Target-repo Issue/PR evidence exists, explain:

- what it suggests about likely unresolved areas
- what it suggests about current prioritization
- whether the repo discussion supports or weakens a given conclusion

### `## 未解決事項・不足情報`

List missing evidence, ambiguities, or data gaps that block a stronger conclusion.

If Target-repo open Issues or unmerged PRs indicate pending decisions, include them here as unresolved candidates with a short evidence note.

### `## 次のアクション`

List practical next steps. Keep them actionable and derived from the findings.

### `## 参照ファイル`

List the concrete files or directories used as evidence.

### `## 主要ファクト`

Place this section at the end of `Report.md`.

Organize findings as flat bullets. Each bullet should connect evidence to an observation.

When the Target is a repository, include fact bullets when evidence exists for:

- notable directories and their responsibilities
- endpoint or operation definitions and what they are used for
- major schemas or data models
- session, lifecycle, status, or state transition handling

For a specification or API repository, do not collapse these into one generic bullet. Write separate fact bullets for directory structure, interface definitions, and data models whenever evidence exists.

If Target-repo Issues or PRs were consulted, include fact bullets such as:

- which topics appear repeatedly in open Issues/PRs
- which items look unresolved
- which direction or proposal is being discussed most actively

## Final checklist

Before finishing, verify:

- the target path is under `insights/`
- the output path is exactly `<target_insight_dir>/Report.md`
- all required sections exist
- `## 主要ファクト` is the last report section
- the Issue summary is based on the real Issue body
- the analysis references evidence from the target directory
- if the Target is a GitHub repository, relevant Issue/PR evidence was considered or its absence was noted
- if the Target is a repository, the report explicitly covers directory structure, interface definitions, major data models, and state/session handling, or explicitly states that evidence was not found for a category
- missing information is called out explicitly
- any cited reference repositories are logged in `references/reference-report.md`
- `references/reference-report.md` uses repository-level `引用元` and Markdown-linked `対象Issue`
