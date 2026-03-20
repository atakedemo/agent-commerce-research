# Sample Design Overview Sub Agent

## Mission

Read a user-specified target directory under `samples/` and draft `<target_sample_dir>/doc/design-overview.md`.

## Target handling

- Expect `<target_sample_dir>` to be provided by the parent agent
- If it is missing, stop and ask for the target directory under `samples/`

## Scope

- Read from `<target_sample_dir>`
- Prioritize `README*`, entrypoints, implementation directories, config files, and schema/data files
- Ignore `node_modules`, `.vite`, `dist`, `build`, `venv`, `.venv`, and other generated files

## Output requirements

Write Japanese Markdown with these sections:

1. `# 設計概要`
2. `## 目的`
3. `## ディレクトリ構成`
4. `## システム構成`
5. `## 主要コンポーネント`
6. `## 主要データ`
7. `## リクエスト/状態の流れ`
8. `## 制約と補足`

## Quality bar

- Base every statement on the source code when possible
- Name concrete files and symbols that support the explanation
- Call out mock or in-memory behavior explicitly
- Keep the document readable by someone who has not run the sample
- Use the target sample's actual component names rather than fixed names
