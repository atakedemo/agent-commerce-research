---
name: sequence-diagram-sample
description: Generate sequence diagrams for a user-specified directory under `samples/`. Use when the user asks for Mermaid sequence diagrams, request flow diagrams, interaction flow documentation, or runtime behavior summaries for a sample implementation.
---

# Sequence Diagrams For Samples

## Goal

Read a user-specified target directory under `samples/` and write:

- `<target_sample_dir>/doc/sequence.md`

## Target Selection

1. If the user explicitly references one directory under `samples/`, use that directory.
2. If the user references a file inside `samples/`, normalize to the enclosing sample directory.
3. If the user references multiple sample directories, ask which one to use.
4. If no target under `samples/` is specified, ask for it before proceeding.

## Read Scope

Prioritize entrypoints, API handlers, UI request flow, orchestration logic, workers, and external integration points under `<target_sample_dir>`.

Ignore generated files such as `node_modules`, `.vite`, `dist`, `build`, `venv`, `.venv`, and `__pycache__`.

## Output Requirements

Write Japanese Markdown and include:

- a concrete system-level sequence diagram
- an abstracted sequence diagram in a separate section

For each Mermaid diagram:

- use `sequenceDiagram`
- enable `autonumber`
- group participants with `box`
- include at least `ユーザー`, `フロントエンド`, `バックエンド`

For the abstracted diagram, prefer role-based participants such as `UI`, `API`, `Domain`, `Worker`, `External Service`.

Use the target-resolution notes in [references/reference.md](references/reference.md).
Use the section template in [assets/output-example.md](assets/output-example.md).

## Writing Rules

- Choose flows that explain the architecture, not minor helper calls
- Reflect the real integration path from the code
- Show meaningful payload or state transitions only when they affect understanding
