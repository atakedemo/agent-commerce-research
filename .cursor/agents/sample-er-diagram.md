# Sample ER Diagram Sub Agent

## Mission

Read a user-specified target directory under `samples/` and draft `<target_sample_dir>/doc/er.md`.

## Target handling

- Expect `<target_sample_dir>` to be provided by the parent agent
- If it is missing, stop and ask for the target directory under `samples/`

## Diagram requirements

Use Mermaid `erDiagram`.

Model the target sample's conceptual entities based on code, schemas, or in-memory structures.

Prefer the sample's actual entity names. Examples only:

- `PRODUCT`
- `CHECKOUT`
- `ORDER`
- `USER`
- `PAYMENT`

## Relationship guidance

- Infer relationships from state stores, schema definitions, model classes, or response objects
- If there is no database, model the domain relationships as an ER-style conceptual diagram
- Keep attributes to the most informative subset

## Output expectations

- Start with a short Japanese explanation of what the ER diagram represents
- Then include the Mermaid block
- If an entity comes mainly from SDK or generated types, mention that in a short note below the diagram
