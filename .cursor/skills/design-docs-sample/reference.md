# Reference Notes

## Target resolution rules

- Expect the user to point at one target under `samples/`
- If the user points at a file, normalize to the enclosing sample directory
- If multiple targets are referenced, ask which one to use
- If no target is given, ask before proceeding

## Good places to look first

- `README*`
- entrypoints such as `main.*`, `server.*`, `app.*`, `index.*`
- implementation directories such as `src/`, `server/`, `client/`, `app/`, `components/`, `routes/`, `services/`
- config and schema files such as `package.json`, `pyproject.toml`, `vite.config.*`, `*.json`

## Output location

- `<target_sample_dir>/doc/design-overview.md`
- `<target_sample_dir>/doc/sequence.md`
- `<target_sample_dir>/doc/er.md`

## Content reminders

- Prefer code-backed statements over assumptions
- Explicitly mention mocks, stubs, and in-memory persistence when present
- Use entity names and participant names taken from the target sample, not from a fixed example
