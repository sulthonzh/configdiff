# configdiff

**Semantic diff for config files — JSON, YAML, TOML. See what actually changed, not just line noise.**

Stop staring at `diff` output trying to figure out if your YAML actually changed. `configdiff` parses both files into structured data and tells you exactly what was added, removed, changed, or type-changed — with full path information.

## Why?

Config files get messy. A regular `git diff` shows you line changes, but what you actually care about is:

- "Did the database port change?"
- "What new keys were added?"
- "Did this value change type from string to number?"

`configdiff` answers those questions directly. It understands the structure of your configs, not just the text.

## Install

```bash
npm install -g configdiff
# or
npx configdiff old.json new.json
```

## Quick Start

```bash
# Compare two JSON files
configdiff config-old.json config-new.json

# Compare YAML (e.g., k8s manifests before/after Helm upgrade)
configdiff values.yaml values-new.yaml

# Compare TOML (e.g., pyproject.toml after dependency update)
configdiff pyproject.toml pyproject.toml.bak

# Cross-format (JSON vs YAML — same structure)
configdiff config.json config.yaml

# JSON output for scripts and CI
configdiff a.json b.json --json
```

## Real-World Examples

### 1. Helm Values Review

You just ran `helm upgrade` and want to verify exactly what changed in the rendered manifests:

```bash
# Render before and after
helm template myapp ./mychart -f values.yaml > before.yaml
helm template myapp ./mychart -f values.new.yaml > after.yaml

# See the semantic diff
configdiff before.yaml after.yaml
```

Output:
```
~ image.tag: "1.2.3" → "1.3.0"
+ replicaCount = 3
~ resources.memory: "256Mi" → "512Mi"

3 differences: 1 added, 0 removed, 2 changed, 0 type-changed
```

### 2. CI Gate for Config Changes

Block PRs that unintentionally change production config values:

```bash
#!/bin/bash
# .github/workflows/config-guard.yml
configdiff config/production.json config/staging.json --json | \
  node -e "
    const changes = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const risky = changes.filter(c => c.path.includes('database') || c.path.includes('secrets'));
    if (risky.length) { console.error('Risky config changes detected!'); process.exit(1); }
  "
```

### 3. Dependency Config Audit

Track what changed in your `pyproject.toml` after updating dependencies:

```bash
configdiff pyproject.toml.bak pyproject.toml
```

Output:
```
+ dependencies[2] = "pydantic>=2.0"
~ dependencies[0]: "fastapi>=0.95" → "fastapi>=0.100"
~ tool.pytest.testpaths[0]: "tests" → "test"

3 differences: 1 added, 0 removed, 2 changed, 0 type-changed
```

## Output Format

```
~ database.host: "localhost" → "prod-db.example.com"
+ database.ssl = true
+ features[2] = "monitoring"
~ version: "1.0.0" → "2.0.0"
+ timeout = 30

5 differences: 3 added, 0 removed, 2 changed, 0 type-changed
```

Symbols:
- `+` added
- `-` removed
- `~` changed
- `!` type-changed (e.g. string → number)

## How It Compares

| Feature | `configdiff` | `jq diff` | `d2` | `git diff` |
|---------|-------------|-----------|------|------------|
| Semantic (structure-aware) | ✅ | ❌ (manual) | ❌ | ❌ |
| YAML support | ✅ | ❌ | ❌ | text only |
| TOML support | ✅ | ❌ | ❌ | text only |
| Cross-format compare | ✅ | ❌ | ❌ | ❌ |
| Zero dependencies | ✅ | ❌ | ❌ | ✅ |
| CI exit codes | ✅ | manual | ❌ | ✅ |
| Type change detection | ✅ | ❌ | ❌ | ❌ |

## API

```js
const { compare, formatHuman, diff, parse } = require('configdiff');

// Compare two config texts
const changes = compare(jsonA, jsonB, 'json', 'json');
console.log(formatHuman(changes));

// Or diff already-parsed objects
const changes2 = diff({ a: 1 }, { a: 2 });

// Parse config text
const obj = parse(yamlText, 'yaml');
```

### `compare(textA, textB, formatA, formatB?)`

Returns an array of change objects:
```js
{ path: ['database', 'host'], type: 'changed', oldValue: 'localhost', newValue: 'prod' }
```

### `diff(objA, objB)`

Compare two already-parsed objects directly.

### `parse(text, format)`

Parse config text into an object. Format: `'json'`, `'yaml'`, or `'toml'`.

## What It Handles

- **JSON** — full support
- **YAML** — nested keys, arrays (block + inline/flow), inline maps, comments, quoted/unquoted strings
- **TOML** — tables, arrays of tables, dotted keys, inline values
- **Cross-format** — compare JSON against YAML, TOML against JSON, etc.

## Zero Dependencies

Just Node.js >= 16. Nothing else.

## Exit Codes

- `0` — no differences
- `1` — differences found (useful in CI)
- `2` — error (invalid file, parse error, etc.)

## License

MIT
