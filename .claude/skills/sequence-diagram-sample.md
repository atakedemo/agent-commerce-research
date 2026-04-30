---
name: sequence-diagram-sample
description: Generate sequence diagrams for a user-specified directory under `samples/` or a public GitHub repository. Use when the user asks for Mermaid sequence diagrams, request flow diagrams, interaction flow documentation, or runtime behavior summaries for a sample implementation or a public repository.
allowed-tools:
  - Bash
  - Read
  - Write
  - mcp__deepwiki__ask_question
  - mcp__deepwiki__read_wiki_structure
  - mcp__deepwiki__read_wiki_contents
---

# Sequence Diagrams For Samples

## Goal

Read a user-specified target (local directory under `samples/` or a public GitHub repository) and write:

- `<target_sample_dir>/doc/sequence.md`

## Target Selection

1. If the user explicitly provides a GitHub repository URL or `owner/repo` reference, treat it as a public repository target and use DeepWiki MCP (see **GitHub Repository via DeepWiki** below).
2. If the user explicitly references one directory under `samples/`, use that directory with local file reading.
3. If the user references a file inside `samples/`, normalize to the enclosing sample directory.
4. If the user references multiple sample directories, ask which one to use.
5. If no target is specified, ask for it before proceeding.

## GitHub Repository via DeepWiki

When the target is a public GitHub repository (`owner/repo` or a GitHub URL):

1. Extract `owner/repo` from the reference.
2. Use `mcp__deepwiki__read_wiki_structure` to identify topics related to request flow, API handlers, or runtime behavior.
3. Use `mcp__deepwiki__ask_question` to collect flow information. Suggested questions:
   - "What is the main request or data flow in this system?"
   - "How do the frontend and backend communicate?"
   - "What are the key API endpoints and how are they called?"
   - "What external services or dependencies are involved in the main flow?"
4. Use `mcp__deepwiki__read_wiki_contents` for specific flow or interaction topics identified in the wiki.
5. Write the output to `doc/<repo-name>/sequence.md` (create the directory as needed).

## Read Scope (local samples)

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
