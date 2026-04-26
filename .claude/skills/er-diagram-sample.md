---
name: er-diagram-sample
description: Generate ER diagrams for a user-specified directory under `samples/`. Use when the user asks for Mermaid ER diagrams, domain model diagrams, entity relationship documentation, or schema-like overviews for a sample implementation.
allowed-tools:
  - Bash
  - Read
  - Write
---

# ER Diagrams For Samples

## Goal

Read a user-specified target directory under `samples/` and write:

- `<target_sample_dir>/doc/er.md`

## Target Selection

1. If the user explicitly references one directory under `samples/`, use that directory.
2. If the user references a file inside `samples/`, normalize to the enclosing sample directory.
3. If the user references multiple sample directories, ask which one to use.
4. If no target under `samples/` is specified, ask for it before proceeding.

## Read Scope

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
