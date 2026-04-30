---
name: design-overview-sample
description: Generate a design overview document for a user-specified directory under `samples/` or a public GitHub repository. Use when the user asks for architecture summary, design overview, component responsibilities, directory structure, or code-based documentation for a sample implementation or a public repository.
allowed-tools:
  - Bash
  - Read
  - Write
  - mcp__deepwiki__ask_question
  - mcp__deepwiki__read_wiki_structure
  - mcp__deepwiki__read_wiki_contents
---

# Design Overview For Samples

## Goal

Read a user-specified target (local directory under `samples/` or a public GitHub repository) and write:

- `<target_sample_dir>/doc/design-overview.md`

## Target Selection

1. If the user explicitly provides a GitHub repository URL or `owner/repo` reference, treat it as a public repository target and use DeepWiki MCP (see **GitHub Repository via DeepWiki** below).
2. If the user explicitly references one directory under `samples/`, use that directory with local file reading.
3. If the user references a file inside `samples/`, normalize to the enclosing sample directory.
4. If the user references multiple sample directories, ask which one to use.
5. If no target is specified, ask for it before proceeding.

## GitHub Repository via DeepWiki

When the target is a public GitHub repository (`owner/repo` or a GitHub URL):

1. Extract `owner/repo` from the reference.
2. Use `mcp__deepwiki__read_wiki_structure` to understand the repository's overall structure.
3. Use `mcp__deepwiki__ask_question` to collect the information needed for each output section. Suggested questions:
   - "What is the purpose and overall architecture of this repository?"
   - "What are the main components and their responsibilities?"
   - "What are the key data models or entities?"
   - "What is the main request or data flow?"
   - "What are the configuration or entry points for this project?"
4. Use `mcp__deepwiki__read_wiki_contents` when you need detail on a specific topic identified from the wiki structure.
5. Write the output to `doc/<repo-name>/design-overview.md` (create the directory as needed).

## Read Scope (local samples)

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
- Treat the output example below as a required output contract, not a loose example
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

---

## Input resolution reminders

- Expect one target under `samples/`
- If the user points at a file, normalize to the enclosing sample directory
- If multiple targets are referenced, ask which one to use
- If no target is given, ask before proceeding

## Good places to look first

- `README*`
- entrypoints such as `main.*`, `server.*`, `app.*`, `index.*`
- implementation directories such as `src/`, `server/`, `client/`, `app/`, `components/`, `routes/`, `services/`
- config and schema files such as `package.json`, `pyproject.toml`, `vite.config.*`, `*.json`

## Content reminders

- Prefer code-backed statements over assumptions
- Explicitly mention mocks, stubs, and in-memory persistence when present
- Use actual component and directory names from the target sample

---

## Output example

```markdown
# 設計概要

このサンプルは、[対象システムの目的] を実現するための実装例である。

## 目的

このサンプルの主な目的は、[何を検証/実現するサンプルか] を示すことである。

## ディレクトリ構成

\`\`\`
├── business_agent          #バックエンドで挙動する決済等を行うAIエージェント
│   ├── src
│   ├── README.md
│   └── pyproject.toml
├── chat-agent              #フロントエンド上のAIエージェント（チャットエージェント）
│   ├── components          #Webコンポーネント
│   ├── App.tsx
│   ├── index.html
│   └── vite.config.ts
└── doc                     #設計書
    ├── design-overview.md  #設計概要
    ├── er.md               #ER図
    └── sequence.md         #シーケンス図
\`\`\`

## システム構成

- フロントエンド: [役割]
- バックエンド: [役割]

## 主要コンポーネント

### [コンポーネント名]
- 対応ファイル: `[path/to/file]`
- 責務: [このコンポーネントが担う責務]

## 主要データ

- `[エンティティ or データ名]`: [役割や保持内容]

## リクエスト/状態の流れ

1. [起点となる操作やイベント]
2. [主要コンポーネント] が [処理内容] を行う
3. [結果として返るレスポンスや最終状態]

## 制約と補足

- [モック実装、未実装部分、運用上の前提]

## カスタマイズを行う対象

### フロントエンド

#### 環境変数などの設定ファイル

例: `chat-agent/config.ts`

\`\`\`json
{
  "apiBaseUrl": "http://localhost:3000",
  "agentProfileUrl": "/profile/agent_profile.json"
}
\`\`\`

#### バックエンドとの疎通

例: `chat-agent/App.tsx`

\`\`\`typescript
const response = await fetch("/api", {
  method: "POST",
  headers: defaultHeaders,
  body: JSON.stringify(payload),
});
\`\`\`

### バックエンド

#### 環境変数などの設定ファイル

例: `business_agent/.env`

\`\`\`bash
GOOGLE_API_KEY=your-api-key
PORT=10999
\`\`\`

#### エントリーポイント

例: `business_agent/src/business_agent/main.py`

\`\`\`python
config = uvicorn.Config(app, host=host, port=port, log_level="info")
server = uvicorn.Server(config)
await server.serve()
\`\`\`
```
