# Changelog

## v1.1.0 — 2026-06-19

### Fixed
- **YAML inline arrays not parsed** — `tags: [a, b, c]` was returned as a raw string instead of an array. Added `parseFlowValue` to handle YAML flow sequences and flow mappings.
- **YAML inline maps not parsed** — `config: {a: 1, b: 2}` was returned as a raw string. Now correctly parsed into objects.
- **Unused `path` import** in CLI removed.

### Added
- `--version` / `-V` flag to CLI.
- `exports` field in package.json for clean ESM/CJS interop.
- `prepublishOnly` script — tests must pass before publish.
- `formatPath` and `formatValue` now exported for programmatic use.
- `parseFlowValue` helper for YAML flow collections.
- CHANGELOG.md added to npm `files`.

### Changed
- Bumped version to 1.1.0.
- README expanded with 3 real-world examples and comparison table.

## v1.0.0 — 2026-06-15

### Initial Release
- Semantic diff engine: detects added, removed, changed, and type-changed values.
- Parsers for JSON, YAML, and TOML.
- Cross-format comparison (e.g., JSON vs YAML).
- Human-readable and JSON output formats.
- CLI with `--json` output and CI-friendly exit codes.
- 50 tests covering parsers, diff engine, formatters, and end-to-end compare.
- Zero dependencies. Node.js >= 16.
