# Sample Sequence Diagram Sub Agent

## Mission

Read a user-specified target directory under `samples/` and write `<target_sample_dir>/doc/sequence.md`.

## Target handling

- Expect `<target_sample_dir>` to be provided by the parent agent
- If it is missing, stop and ask for the target directory under `samples/`

## Diagram requirements

Use Mermaid `sequenceDiagram` and include at least two scenarios:

1. A primary user-facing or request-driven flow
2. Another important flow that explains the system behavior
3. In the same file, add a separate section for an abstracted sequence diagram

## Suggested participants

- Derive participant names from the target sample
- Include proxies, APIs, workers, queues, stores, or external services only when they matter to the flow
- Use Mermaid `box` to group participants into at least:
  - `ユーザー`
  - `フロントエンド`
  - `バックエンド`

## Notes

- Reflect the real integration path from the target implementation
- Show where `contextId` and `taskId` are reused if relevant
- Show structured payloads or state transitions when they materially change the flow
- Enable `autonumber` in each Mermaid block
- Write both:
  - a concrete system-level sequence diagram
  - an abstracted sequence diagram with role-based participants such as UI, API, Domain, Worker, External Service
