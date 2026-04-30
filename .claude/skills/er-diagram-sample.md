---
name: er-diagram-sample
description: Generate ER diagrams for a user-specified directory under `samples/` or a public GitHub repository. Use when the user asks for Mermaid ER diagrams, domain model diagrams, entity relationship documentation, or schema-like overviews for a sample implementation or a public repository.
allowed-tools:
  - Bash
  - Read
  - Write
  - mcp__deepwiki__ask_question
  - mcp__deepwiki__read_wiki_structure
  - mcp__deepwiki__read_wiki_contents
---

# ER Diagrams For Samples

## Goal

Read a user-specified target (local directory under `samples/` or a public GitHub repository) and write:

- `<target_sample_dir>/doc/er.md`

## Target Selection

1. If the user explicitly provides a GitHub repository URL or `owner/repo` reference, treat it as a public repository target and use DeepWiki MCP (see **GitHub Repository via DeepWiki** below).
2. If the user explicitly references one directory under `samples/`, use that directory with local file reading.
3. If the user references a file inside `samples/`, normalize to the enclosing sample directory.
4. If the user references multiple sample directories, ask which one to use.
5. If no target is specified, ask for it before proceeding.

## GitHub Repository via DeepWiki

When the target is a public GitHub repository (`owner/repo` or a GitHub URL):

1. Extract `owner/repo` from the reference.
2. Use `mcp__deepwiki__read_wiki_structure` to find data model, schema, or entity-related topics.
3. Use `mcp__deepwiki__ask_question` to collect entity information. Suggested questions:
   - "What are the main data models or entities in this repository?"
   - "What schemas or database models are defined and how are they related?"
   - "What are the key attributes of each entity or model?"
4. Use `mcp__deepwiki__read_wiki_contents` for specific schema or model topics identified in the wiki.
5. Write the output to `doc/<repo-name>/er.md` (create the directory as needed).

## Read Scope (local samples)

Prioritize model classes, schema files, state containers, response objects, persistence code, and domain definitions under `<target_sample_dir>`.

Ignore generated files such as `node_modules`, `.vite`, `dist`, `build`, `venv`, `.venv`, and `__pycache__`.

## Output Requirements

Write Japanese Markdown with:

- a short explanation of what the ER diagram represents
- one Mermaid `erDiagram` block
- a short note when the entities are derived from SDK or generated types

Use the sample's actual entity names when possible. If there is no real database, model the domain relationships conceptually.

## Writing Rules

- Ground relationships in code, schemas, or state structures
- Keep attributes to the most informative subset
- Prefer clarity over completeness

---

## Input resolution reminders

- Expect one target under `samples/`
- If the user points at a file, normalize to the enclosing sample directory
- If multiple targets are referenced, ask which one to use
- If no target is given, ask before proceeding

## Good places to look first

- model classes and schema files
- state containers and response objects
- persistence code and domain definitions

## Content reminders

- Use actual entity names when they are clear from the code
- If there is no real database, model domain relationships conceptually
- Keep attributes to the most informative subset

---

## Output example

```markdown
# ER図

このER図は、[対象システム] の主要なドメイン関係を表す。

\`\`\`mermaid
erDiagram
    ENTITY_A ||--o{ ENTITY_B : has
    ENTITY_A ||--o| ENTITY_C : uses

    ENTITY_A {
        string id
        string name
    }

    ENTITY_B {
        string id
        string entity_a_id
    }
\`\`\`

## 補足

- [SDK由来の型、概念モデルとしての補足、属性の省略方針]
```
