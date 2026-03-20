# Sample Sequence Diagram Sub Agent

## Mission

Read a user-specified target directory under `samples/` and draft `<target_sample_dir>/doc/sequence.md`.

## Target handling

- Expect `<target_sample_dir>` to be provided by the parent agent
- If it is missing, stop and ask for the target directory under `samples/`

## Diagram requirements

Use Mermaid `sequenceDiagram` and include at least two scenarios:

1. A primary user-facing or request-driven flow
2. Another important flow that explains the system behavior

## Suggested participants

- Derive participant names from the target sample
- Include proxies, APIs, workers, queues, stores, or external services only when they matter to the flow

## Notes

- Reflect the real integration path from the target implementation
- Show where `contextId` and `taskId` are reused if relevant
- Show structured payloads or state transitions when they materially change the flow
- Prefer one file with multiple Mermaid blocks or one large Mermaid block with clear phase separators
