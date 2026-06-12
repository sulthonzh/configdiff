# configdiff

Semantic diff for config files — JSON, YAML, TOML.

Stop staring at `diff` output trying to figure out if your YAML actually changed. `configdiff` parses both files into structured data and tells you exactly what was added, removed, changed, or type-changed — with full path information.

## Why?

Config files get messy. A regular diff shows you line changes, but what you actually care about is:
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

## Usage

```bash
# Compare two JSON files
configdiff config-old.json config-new.json

# Compare YAML
configdiff docker-compose.yml docker-compose.new.yml

# Compare TOML
configdiff pyproject.toml pyproject.toml.bak

# Cross-format (JSON vs YAML — same structure)
configdiff config.json config.yaml

# JSON output for scripts
configdiff a.json b.json --json
```

## Output

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

## API

```js
const { compare, formatHuman } = require('configdiff');

const changes = compare(jsonA, jsonB, 'json', 'json');
console.log(formatHuman(changes));
// or use changes directly — each has: path, type, oldValue/newValue
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
- **YAML** — common patterns (nested keys, arrays, inline values, comments)
- **TOML** — tables, arrays of tables, inline values
- **Cross-format** — compare JSON against YAML, TOML against JSON, etc.

## Zero Dependencies

Just Node.js >= 16. Nothing else.

## Exit Codes

- `0` — no differences
- `1` — differences found (useful in CI)
- `2` — error (invalid file, parse error, etc.)

## License

MIT
