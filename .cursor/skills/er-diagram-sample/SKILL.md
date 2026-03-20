---
name: er-diagram-sample
description: Generate ER diagrams for a user-specified directory under `samples/`. Use when the user asks for Mermaid ER diagrams, domain model diagrams, entity relationship documentation, or schema-like overviews for a sample implementation.
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

Use the target-resolution notes in [references/reference.md](references/reference.md).
Use the structure example in [assets/output-example.md](assets/output-example.md).

## Writing Rules

- Ground relationships in code, schemas, or state structures
- Keep attributes to the most informative subset
- Prefer clarity over completeness
