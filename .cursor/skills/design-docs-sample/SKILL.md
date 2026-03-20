---
name: design-docs-sample
description: Analyze a user-specified directory under `samples/` and generate design documents. Use when the user asks for a design overview, sequence diagram, ER diagram, architecture summary, or code-based documentation for a sample implementation.
---

# Design Docs For Samples

## Goal

Read a user-specified target directory under `samples/` and create or update these files:

- `<target_sample_dir>/doc/design-overview.md`
- `<target_sample_dir>/doc/sequence.md`
- `<target_sample_dir>/doc/er.md`

## Target Selection

Resolve the target before reading code:

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

Do not spend time on:

- `node_modules/**`
- `venv/**`
- `.venv/**`
- `.vite/**`
- `dist/**`
- `build/**`
- `__pycache__/**`
- generated caches or build outputs

## Workflow

1. Resolve `<target_sample_dir>`.
2. Read entrypoints and stateful/domain code first.
3. Read UI/API/integration flow next if the sample includes them.
4. Extract facts, then separate assumptions from confirmed behavior.
5. Update all 3 docs together so their terminology stays aligned.

## Design Overview Requirements

Include:

- Purpose of the sample
- High-level architecture
- Main runtime components and responsibilities
- Main request or event flow between the sample's core components
- Main state objects and domain entities
- Notable limitations such as mock/in-memory behavior

Recommended sections:

- `# 設計概要`
- `## 目的`
- `## システム構成`
- `## 主要コンポーネント`
- `## 主要データ`
- `## リクエスト/状態の流れ`
- `## 制約と補足`

## Sequence Diagram Requirements

Use Mermaid `sequenceDiagram`.

Include at least:

- Two important flows from the target sample's actual behavior
- Prefer user-facing flows, API flows, or processing flows that explain the architecture

Recommended participants:

- Choose participant names from the target implementation
- Include gateways such as proxy/API server/worker only when they matter to the flow

## ER Diagram Requirements

Use Mermaid `erDiagram`.

Model conceptual entities from the code, not a real database schema.

Include at least:

- The main domain entities that appear in the target sample
- Relationships grounded in code or schema definitions

If the sample has no clear ER-style domain model, use the closest conceptual model and say that briefly.

## Writing Rules

- Prefer facts grounded in code.
- If behavior is inferred from external SDK models, say so briefly.
- Keep prose concise.
- Use Japanese for the document body unless the user asks otherwise.

## Supporting Files

- Sub-agent prompt templates live in `.cursor/agents/`
- Document templates should be created in `<target_sample_dir>/doc/`
