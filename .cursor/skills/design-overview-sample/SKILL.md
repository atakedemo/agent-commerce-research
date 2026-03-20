---
name: design-overview-sample
description: Generate a design overview document for a user-specified directory under `samples/`. Use when the user asks for architecture summary, design overview, component responsibilities, directory structure, or code-based documentation for a sample implementation.
---

# Design Overview For Samples

## Goal

Read a user-specified target directory under `samples/` and write:

- `<target_sample_dir>/doc/design-overview.md`

## Target Selection

1. If the user explicitly references one directory under `samples/`, use that directory.
2. If the user references a file inside `samples/`, normalize to the enclosing sample directory.
3. If the user references multiple sample directories, ask which one to use.
4. If no target under `samples/` is specified, ask for it before proceeding.

## Read Scope

Within `<target_sample_dir>`, prioritize:

- `README*`
- runtime entrypoints such as `main.*`, `server.*`, `app.*`, `index.*`
- implementation directories such as `src/`, `server/`, `client/`, `app/`, `components/`, `routes/`, `services/`
- config files such as `package.json`, `pyproject.toml`, `vite.config.*`, `tsconfig.json`, `*.json`
- domain data or schema files used by the sample

Ignore generated files such as `node_modules`, `.vite`, `dist`, `build`, `venv`, `.venv`, and `__pycache__`.

## Output Requirements

Write Japanese Markdown with these sections:

1. `# 設計概要`
2. `## 目的`
3. `## ディレクトリ構成`
4. `## システム構成`
5. `## 主要コンポーネント`
6. `## 主要データ`
7. `## リクエスト/状態の流れ`
8. `## 制約と補足`
9. `## カスタマイズを行う対象`

Use the target-resolution notes in [references/reference.md](references/reference.md).
Use the section template in [assets/output-example.md](assets/output-example.md).

### Mandatory Format For `## カスタマイズを行う対象`

`## カスタマイズを行う対象` is not optional prose. It must follow this structure:

1. Include both `### フロントエンド` and `### バックエンド`
2. Under each, include at least 2 `####` subsections that identify concrete customization points
3. In each `####` subsection, include:
   - a concrete target file path
   - a short explanation of what changes when that file is customized
   - at least 1 fenced code block based on the target sample's real code
4. Use code fences with an explicit language tag such as `typescript`, `python`, `json`, or `bash`
5. Do not end this section with bullet points alone

Minimum bar:

- At least 4 fenced code blocks total in `## カスタマイズを行う対象`
- At least 2 code blocks for frontend customization points
- At least 2 code blocks for backend customization points

## Writing Rules

- Base statements on source code when possible
- Name concrete files and symbols that support the explanation
- Call out mocks, stubs, and in-memory behavior explicitly
- Use the target sample's actual component names
- Treat the structure in [assets/output-example.md](assets/output-example.md) as a required output contract, not a loose example
- In `## カスタマイズを行う対象`, code blocks must be derived from files that actually exist under the target sample directory
- Do not write placeholders like `[その他主要な処理]` in the final document
- Do not write `例:` without also including the corresponding fenced code block

## Final Checklist

Before finishing, verify all of the following:

- `## カスタマイズを行う対象` exists
- `### フロントエンド` and `### バックエンド` both exist
- Each side has at least 2 concrete `####` customization points
- Each `####` customization point includes a fenced code block
- There are at least 4 fenced code blocks total in `## カスタマイズを行う対象`
- The code blocks are based on real code from the target sample
