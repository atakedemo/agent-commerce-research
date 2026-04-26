---
name: sequence-diagram-sample
description: Generate sequence diagrams for a user-specified directory under `samples/`. Use when the user asks for Mermaid sequence diagrams, request flow diagrams, interaction flow documentation, or runtime behavior summaries for a sample implementation.
allowed-tools:
  - Bash
  - Read
  - Write
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

## Writing Rules

- Choose flows that explain the architecture, not minor helper calls
- Reflect the real integration path from the code
- Show meaningful payload or state transitions only when they affect understanding

---

## Input resolution reminders

- Expect one target under `samples/`
- If the user points at a file, normalize to the enclosing sample directory
- If multiple targets are referenced, ask which one to use
- If no target is given, ask before proceeding

## Good places to look first

- entrypoints such as `main.*`, `server.*`, `app.*`, `index.*`
- request handlers, routes, services, workers, and orchestration code
- UI interaction flow and client-side API calls when present

## Content reminders

- Prefer major runtime flows over helper-level interactions
- Use participant names taken from the target sample for the concrete diagram
- Use role-based participants for the abstracted diagram when that improves readability

---

## Output example

```markdown
# シーケンス図

## システムレベル

\`\`\`mermaid
sequenceDiagram
    autonumber
    box ユーザー
        actor User
    end
    box フロントエンド
        participant UI
    end
    box バックエンド
        participant API
        participant Domain
    end

    User->>UI: [操作]
    UI->>API: [リクエスト]
    API->>Domain: [処理]
    Domain-->>API: [結果]
    API-->>UI: [レスポンス]
\`\`\`

## 抽象化した流れ

\`\`\`mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as フロントエンド<br>（Webアプリ）
    participant Service as バックエンド

    User->>UI: [要求]
    UI->>Service: [処理依頼]
    Service-->>UI: [結果]
\`\`\`
```
