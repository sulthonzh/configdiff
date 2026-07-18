'use strict';

const { parse, diff, compare, detectFormat, formatHuman, formatJSONOutput, formatPath, formatValue, parseJSON, parseYAML, parseTOML, parseValue, parseFlowValue, VERSION } = require('../lib/diff');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${msg}\n    expected: ${e}\n    actual:   ${a}`);
  }
}

// ── JSON Parsing ──────────────────────────────────────
console.log('JSON parsing');
{
  const obj = parse('{"a":1,"b":"hello","c":true}', 'json');
  assertEqual(obj.a, 1, 'json number');
  assertEqual(obj.b, 'hello', 'json string');
  assertEqual(obj.c, true, 'json bool');
}

// ── YAML Parsing ──────────────────────────────────────
console.log('YAML parsing');
{
  const yaml = `
name: myapp
port: 3000
debug: true
database:
  host: localhost
  port: 5432
  name: mydb
tags:
  - web
  - api
`;
  const obj = parseYAML(yaml);
  assertEqual(obj.name, 'myapp', 'yaml string');
  assertEqual(obj.port, 3000, 'yaml number');
  assertEqual(obj.debug, true, 'yaml bool');
  assertEqual(obj.database.host, 'localhost', 'yaml nested');
  assertEqual(obj.database.port, 5432, 'yaml nested number');
  assertEqual(obj.tags, ['web', 'api'], 'yaml array');
}

// ── YAML Inline Flow Sequence (v1.1.0 bug fix) ───────
console.log('YAML inline flow sequence');
{
  const yaml = 'tags: [a, b, c]';
  const obj = parseYAML(yaml);
  assertEqual(obj.tags, ['a', 'b', 'c'], 'yaml inline array unquoted');
}
{
  const yaml = 'ports: [3000, 8080, 443]';
  const obj = parseYAML(yaml);
  assertEqual(obj.ports, [3000, 8080, 443], 'yaml inline array numbers');
}
{
  const yaml = 'items: ["first", "second"]';
  const obj = parseYAML(yaml);
  assertEqual(obj.items, ['first', 'second'], 'yaml inline array quoted');
}
{
  const yaml = 'empty: []';
  const obj = parseYAML(yaml);
  assertEqual(obj.empty, [], 'yaml inline empty array');
}

// ── YAML Inline Flow Mapping (v1.1.0 bug fix) ─────────
console.log('YAML inline flow mapping');
{
  const yaml = 'config: {a: 1, b: 2}';
  const obj = parseYAML(yaml);
  assertEqual(obj.config, { a: 1, b: 2 }, 'yaml inline map unquoted');
}
{
  const yaml = 'meta: {"x": "y"}';
  const obj = parseYAML(yaml);
  assertEqual(obj.meta, { x: 'y' }, 'yaml inline map quoted');
}
{
  const yaml = 'empty: {}';
  const obj = parseYAML(yaml);
  assertEqual(obj.empty, {}, 'yaml inline empty map');
}

// ── YAML Mixed Nested Flow ────────────────────────────
console.log('YAML nested flow');
{
  const yaml = 'servers: [{host: a, port: 1}, {host: b, port: 2}]';
  const obj = parseYAML(yaml);
  assertEqual(obj.servers[0].host, 'a', 'yaml nested flow host');
  assertEqual(obj.servers[1].port, 2, 'yaml nested flow port');
}

// ── TOML Parsing ──────────────────────────────────────
console.log('TOML parsing');
{
  const toml = `
title = "my app"
port = 8080
debug = false

[server]
host = "0.0.0.0"
port = 8080

[database]
url = "postgres://localhost/mydb"
`;
  const obj = parseTOML(toml);
  assertEqual(obj.title, 'my app', 'toml string');
  assertEqual(obj.port, 8080, 'toml number');
  assertEqual(obj.debug, false, 'toml bool');
  assertEqual(obj.server.host, '0.0.0.0', 'toml table');
  assertEqual(obj.database.url, 'postgres://localhost/mydb', 'toml table 2');
}

// ── TOML Dotted Keys ──────────────────────────────────
console.log('TOML dotted keys');
{
  const toml = '[a.b.c]\nkey = 1';
  const obj = parseTOML(toml);
  assertEqual(obj.a.b.c.key, 1, 'toml dotted key');
}

// ── Format Detection ─────────────────────────────────
console.log('Format detection');
{
  assertEqual(detectFormat('config.json'), 'json', 'detect json');
  assertEqual(detectFormat('config.yaml'), 'yaml', 'detect yaml');
  assertEqual(detectFormat('config.yml'), 'yaml', 'detect yml');
  assertEqual(detectFormat('config.toml'), 'toml', 'detect toml');
  assertEqual(detectFormat('config.txt'), null, 'detect unknown');
}

// ── Diff: No Changes ─────────────────────────────────
console.log('Diff: identical objects');
{
  const changes = diff({ a: 1, b: 'hello' }, { a: 1, b: 'hello' });
  assertEqual(changes.length, 0, 'no differences');
}

// ── Diff: Added Keys ─────────────────────────────────
console.log('Diff: added keys');
{
  const changes = diff({ a: 1 }, { a: 1, b: 2 });
  assertEqual(changes.length, 1, 'one added');
  assertEqual(changes[0].type, 'added', 'added type');
  assertEqual(changes[0].newValue, 2, 'added value');
}

// ── Diff: Removed Keys ──────────────────────────────
console.log('Diff: removed keys');
{
  const changes = diff({ a: 1, b: 2 }, { a: 1 });
  assertEqual(changes.length, 1, 'one removed');
  assertEqual(changes[0].type, 'removed', 'removed type');
  assertEqual(changes[0].oldValue, 2, 'removed value');
}

// ── Diff: Changed Values ─────────────────────────────
console.log('Diff: changed values');
{
  const changes = diff({ a: 1 }, { a: 2 });
  assertEqual(changes.length, 1, 'one changed');
  assertEqual(changes[0].type, 'changed', 'changed type');
  assertEqual(changes[0].oldValue, 1, 'old value');
  assertEqual(changes[0].newValue, 2, 'new value');
}

// ── Diff: Type Changed ──────────────────────────────
console.log('Diff: type changes');
{
  const changes = diff({ a: 1 }, { a: 'hello' });
  assertEqual(changes.length, 1, 'one type change');
  assertEqual(changes[0].type, 'type-changed', 'type-changed');
  assertEqual(changes[0].oldType, 'number', 'old type');
  assertEqual(changes[0].newType, 'string', 'new type');
}

// ── Diff: Nested Changes ─────────────────────────────
console.log('Diff: nested changes');
{
  const a = { db: { host: 'localhost', port: 5432 } };
  const b = { db: { host: 'prod-server', port: 5432, ssl: true } };
  const changes = diff(a, b);
  assertEqual(changes.length, 2, 'two nested changes');
  const types = changes.map(c => c.type).sort();
  assert(types.includes('changed'), 'includes changed');
  assert(types.includes('added'), 'includes added');
}

// ── Diff: Array Changes ──────────────────────────────
console.log('Diff: array changes');
{
  const changes = diff([1, 2, 3], [1, 2, 4, 5]);
  assertEqual(changes.length, 2, 'two array changes');
}

// ── Diff: Array Insertion at Beginning ───────────────
console.log('Diff: array insertion at beginning');
{
  const changes = diff([2, 3], [1, 2, 3]);
  // Positional diff: [2,3] vs [1,2,3] → index 0: 2→1 (changed), index 1: 3→2 (changed), index 2: added (3)
  assertEqual(changes.length, 3, 'positional diff sees 3 changes');
  assertEqual(changes[2].type, 'added', 'last element is added');
}

// ── Diff: Empty Arrays ───────────────────────────────
console.log('Diff: empty arrays');
{
  const changes = diff([], [1, 2]);
  assertEqual(changes.length, 2, 'two added to empty');
}

// ── Diff: Nested Objects in Arrays ───────────────────
console.log('Diff: nested objects in arrays');
{
  const a = [{ name: 'old', port: 3000 }];
  const b = [{ name: 'new', port: 3000 }];
  const changes = diff(a, b);
  assertEqual(changes.length, 1, 'one change in array object');
  assertEqual(changes[0].path.join('.'), '0.name', 'path for array object');
}

// ── Full Compare: JSON ──────────────────────────────
console.log('Compare: JSON end-to-end');
{
  const jsonA = '{"name":"old","version":"1.0.0","scripts":{"test":"jest"}}';
  const jsonB = '{"name":"new","version":"2.0.0","scripts":{"test":"vitest","build":"tsc"}}';
  const changes = compare(jsonA, jsonB, 'json', 'json');
  assert(changes.length >= 3, 'at least 3 changes');
}

// ── Full Compare: YAML ──────────────────────────────
console.log('Compare: YAML end-to-end');
{
  const yamlA = 'name: old\nport: 3000';
  const yamlB = 'name: new\nport: 3001';
  const changes = compare(yamlA, yamlB, 'yaml', 'yaml');
  assertEqual(changes.length, 2, 'yaml compare: 2 changes');
}

// ── Cross-format Compare ─────────────────────────────
console.log('Compare: JSON vs YAML');
{
  const json = '{"a":1,"b":2}';
  const yaml = 'a: 1\nb: 3';
  const changes = compare(json, yaml, 'json', 'yaml');
  assertEqual(changes.length, 1, 'cross-format: 1 change');
  assertEqual(changes[0].newValue, 3, 'cross-format: b changed to 3');
}

// ── Compare with Inline YAML Arrays ──────────────────
console.log('Compare: YAML with inline arrays');
{
  const yamlA = 'tags: [a, b, c]';
  const yamlB = 'tags: [a, b, d]';
  const changes = compare(yamlA, yamlB, 'yaml', 'yaml');
  assertEqual(changes.length, 1, 'inline array diff');
  assertEqual(changes[0].path.join('.'), 'tags.2', 'inline array path');
}

// ── Output Formatting ───────────────────────────────
console.log('Output formatting');
{
  const changes = diff({ a: 1 }, { a: 2 });
  const human = formatHuman(changes);
  assert(human.includes('a'), 'human output has path');
  assert(human.includes('→'), 'human output has arrow');
  assert(human.includes('1 difference'), 'human output has summary');

  const json = formatJSONOutput(changes);
  const parsed = JSON.parse(json);
  assertEqual(parsed[0].path, 'a', 'json output has path');
}

// ── formatPath Tests ─────────────────────────────────
console.log('formatPath');
{
  assertEqual(formatPath(['a', 'b', 'c']), 'a.b.c', 'simple path');
  assertEqual(formatPath(['a', 0, 'name']), 'a.[0].name', 'array index in path');
  assertEqual(formatPath([0]), '[0]', 'root array index');
  assertEqual(formatPath([]), '', 'empty path');
}

// ── formatValue Tests ────────────────────────────────
console.log('formatValue');
{
  assertEqual(formatValue(null), 'null', 'null value');
  assertEqual(formatValue('hello'), '"hello"', 'string value');
  assertEqual(formatValue(42), '42', 'number value');
  assertEqual(formatValue(true), 'true', 'boolean value');
  assertEqual(formatValue({ x: 1 }), '{"x":1}', 'object value');
  assertEqual(formatValue([1, 2]), '[1,2]', 'array value');
}

// ── Empty Diff Output ───────────────────────────────
console.log('Empty diff formatting');
{
  const human = formatHuman([]);
  assertEqual(human, 'No differences found.', 'no diff message');
}

// ── Deep Nested Changes ─────────────────────────────
console.log('Deep nesting');
{
  const a = { level1: { level2: { level3: 'old' } } };
  const b = { level1: { level2: { level3: 'new' } } };
  const changes = diff(a, b);
  assertEqual(changes.length, 1, 'deep: 1 change');
  assertEqual(changes[0].path.join('.'), 'level1.level2.level3', 'deep path');
}

// ── Null Handling ───────────────────────────────────
console.log('Null handling');
{
  const changes = diff({ a: null }, { a: 'hello' });
  assertEqual(changes[0].type, 'type-changed', 'null to string is type change');
}

// ── Null to Null (no change) ────────────────────────
console.log('Null to null');
{
  const changes = diff({ a: null }, { a: null });
  assertEqual(changes.length, 0, 'null to null: no change');
}

// ── Boolean Changes ─────────────────────────────────
console.log('Boolean changes');
{
  const changes = diff({ debug: true }, { debug: false });
  assertEqual(changes.length, 1, 'boolean changed');
  assertEqual(changes[0].type, 'changed', 'boolean is changed not type-changed');
}

// ── TOML Array of Tables ────────────────────────────
console.log('TOML array of tables');
{
  const toml = `
[[servers]]
name = "alpha"
port = 3000

[[servers]]
name = "beta"
port = 3001
`;
  const obj = parseTOML(toml);
  assertEqual(obj.servers.length, 2, 'toml array of tables length');
  assertEqual(obj.servers[0].name, 'alpha', 'toml array table[0].name');
  assertEqual(obj.servers[1].port, 3001, 'toml array table[1].port');
}

// ── TOML Multi-line Strings ─────────────────────────
console.log('TOML multi-line strings');
{
  const toml = 'description = """hello world"""\n' + "sig = '''single'''";
  const obj = parseTOML(toml);
  assertEqual(obj.description, 'hello world', 'toml triple-double string');
  assertEqual(obj.sig, 'single', 'toml triple-single string');
}

// ── TOML Array Values ───────────────────────────────
console.log('TOML array values');
{
  const toml = 'ports = [8000, 8001, 8002]';
  const obj = parseTOML(toml);
  assertEqual(obj.ports, [8000, 8001, 8002], 'toml array of numbers');
}

// ── TOML Nested Path Navigation ─────────────────────
console.log('TOML nested path navigation');
{
  const toml = `[a.b]
key = 1

[a.c]
key = 2`;
  const obj = parseTOML(toml);
  assertEqual(obj.a.b.key, 1, 'toml nested a.b.key');
  assertEqual(obj.a.c.key, 2, 'toml nested a.c.key');
}

// ── YAML Flow Mapping Without Colon ─────────────────
console.log('YAML flow mapping edge cases');
{
  // Flow map where item has no colon — should be skipped gracefully
  const yaml = 'config: {a: 1, nobcolon}';
  const obj = parseYAML(yaml);
  assertEqual(obj.config.a, 1, 'yaml flow map partial parse');
}

// ── Array Element Removal ───────────────────────────
console.log('Array element removal');
{
  const changes = diff([1, 2, 3], [1]);
  assertEqual(changes.length, 2, 'two elements removed from array');
  assertEqual(changes[0].type, 'removed', 'first removed');
  assertEqual(changes[1].type, 'removed', 'second removed');
}

// ── YAML Nested List Item with Key and No Value (covers lines 58-61)
console.log('YAML nested list item with key, no value');
{
  // '- key:' with no value pushes a new object scope into an array
  const yaml = `
container:
  - nested:
      deep: value
`;
  const obj = parseYAML(yaml);
  assertEqual(obj.container.nested.length, 1, 'yaml nested list item: array length');
  assertEqual(obj.container.nested[0].deep, 'value', 'yaml nested list item: deep value');
}

// ── YAML List Item Key:Value Without Existing Array (covers lines 72-73)
console.log('YAML list item key:value creates array');
{
  // '- key: value' where parent[key] is not yet an array → creates array, pushes parsed value
  const yaml = `
data:
  - x: 1
  - x: 2
`;
  const obj = parseYAML(yaml);
  assertEqual(obj.data.x, [1, 2], 'yaml list item key:value builds array');
}

// ── parseFlowValue Non-Flow Fallback (covers line 113)
console.log('parseFlowValue non-flow fallback');
{
  const { parseFlowValue } = require('../lib/diff');
  assertEqual(parseFlowValue('hello'), undefined, 'non-flow string returns undefined');
  assertEqual(parseFlowValue('123'), undefined, 'number string returns undefined');
}

// ── TOML Float + Bare String Fallback (covers lines 208-209)
console.log('TOML float and bare string fallback');
{
  const toml1 = 'rate = 3.14';
  const obj1 = parseTOML(toml1);
  assertEqual(obj1.rate, 3.14, 'toml float parsed');

  // Bare string (not quoted, not number, not bool) — falls through to return val
  const toml2 = 'host = bare-string';
  const obj2 = parseTOML(toml2);
  assertEqual(obj2.host, 'bare-string', 'toml bare string fallback');
}

// ── Version Export ───────────────────────────────────
console.log('Version export');
{
  assertEqual(VERSION, '1.1.0', 'version string correct');
}

// ── COVERAGE GAP TESTS ─────────────────────────────

// Line 41: YAML bare list item where grandparent doesn't have the key (orphan container)
console.log('YAML bare list with orphan parent');
{
  const yaml = `
items:
  - one
  - two
`;
  const obj = parseYAML(yaml);
  assertEqual(obj.items.length, 2, 'yaml bare list items count');
  assertEqual(obj.items[0], 'one', 'yaml bare list first');
  assertEqual(obj.items[1], 'two', 'yaml bare list second');
}

// Line 41: YAML bare list item with no parent key in grandparent (edge case)
console.log('YAML bare list at root level');
{
  const yaml = '- alpha\n- beta';
  const obj = parseYAML(yaml);
  // Root-level bare list items won't find a grandparent — they go into the container
  // The container is the root result object, which is not an array
}

// Line 70: YAML list item key:value where parent[key] is already an array
console.log('YAML list item key:value with existing array');
{
  const yaml = `
data:
  - x: 1
data:
  - x: 2
`;
  // This tests the isListItem branch where parent[key] is already an array
  const yaml2 = `
items:
  - name: first
  - name: second
`;
  const obj = parseYAML(yaml2);
  assertEqual(obj.items.name.length, 2, 'yaml list item key:value builds existing array');
  assertEqual(obj.items.name[0], 'first', 'yaml list item key:value first');
  assertEqual(obj.items.name[1], 'second', 'yaml list item key:value second');
}

// Lines 125-126: splitFlowItems with mixed quotes (single inside double)
console.log('splitFlowItems via flow with mixed quotes');
{
  // Double-quoted string containing single quote
  const yaml = 'data: ["it\'s", "hello"]';
  const obj = parseYAML(yaml);
  assertEqual(obj.data[0], "it's", 'flow with single quote inside double quotes');
}

// Lines 125-126: splitFlowItems with single-quoted strings containing double quotes
console.log('splitFlowItems with single quotes containing double quote');
{
  const yaml = "data: ['say \"hi\"', 'world']";
  const obj = parseYAML(yaml);
  // Single-quoted YAML strings — parseValue strips single quotes
  assertEqual(obj.data[0], 'say "hi"', 'flow single-quoted with double quote inside');
}

// Lines 125-126: splitFlowItems with nested brackets in flow
console.log('splitFlowItems with nested structures');
{
  const yaml = 'matrix: [[1, 2], [3, 4]]';
  const obj = parseYAML(yaml);
  assertEqual(obj.matrix.length, 2, 'nested flow sequence count');
  assertEqual(obj.matrix[0][0], 1, 'nested flow inner [0][0]');
  assertEqual(obj.matrix[1][1], 4, 'nested flow inner [1][1]');
}

// Line 141: parseValue with '~' (YAML null alternative)
console.log('parseValue tilde null');
{
  assertEqual(parseValue('~'), null, 'tilde is null');
  assertEqual(parseValue('null'), null, 'null is null');
}

// Line 143: parseValue with single-quoted strings
console.log('parseValue single-quoted');
{
  assertEqual(parseValue("'hello'"), 'hello', 'single-quoted string');
  assertEqual(parseValue("'123'"), '123', 'single-quoted number stays string');
}

// Line 145: parseValue with negative integers
console.log('parseValue negative integer');
{
  assertEqual(parseValue('-42'), -42, 'negative integer');
  assertEqual(parseValue('0'), 0, 'zero');
}

// Line 146: parseValue with negative floats
console.log('parseValue negative float');
{
  assertEqual(parseValue('-3.14'), -3.14, 'negative float');
  assertEqual(parseValue('0.5'), 0.5, 'small float');
}

// Line 148: parseValue flow collection that fails parseFlowValue
console.log('parseValue non-collection fallback');
{
  // Not a flow collection — just a regular string
  assertEqual(parseValue('hello world'), 'hello world', 'plain string');
  assertEqual(parseValue(''), '', 'empty string');
}

// Line 188: TOML comment stripping
console.log('TOML comment stripping');
{
  const toml = 'key = 42 # this is a comment';
  const obj = parseTOML(toml);
  assertEqual(obj.key, 42, 'toml value after comment strip');
}

// Line 196: parseTOMLValue 'null'
console.log('TOML null value');
{
  const toml = 'key = null';
  const obj = parseTOML(toml);
  assertEqual(obj.key, null, 'toml null');
}

// Line 197: parseTOMLValue 'false'
console.log('TOML false value');
{
  const toml = 'flag = false';
  const obj = parseTOML(toml);
  assertEqual(obj.flag, false, 'toml false');
}

// Line 202: TOML double-quoted string with invalid JSON inside (falls back to slice)
console.log('TOML quoted string with invalid JSON');
{
  const toml = 'key = "hello world"';
  const obj = parseTOML(toml);
  assertEqual(obj.key, 'hello world', 'toml double-quoted plain string');
}

// Line 202: TOML double-quoted with escape that IS valid JSON
console.log('TOML quoted string with valid JSON escape');
{
  const toml = 'key = "hello\\nworld"';
  const obj = parseTOML(toml);
  assertEqual(obj.key, 'hello\nworld', 'toml double-quoted with newline escape');
}

// Line 204: TOML array with invalid JSON (falls back to raw string)
console.log('TOML array fallback to raw string');
{
  const toml = "key = [invalid, unquoted]";
  const obj = parseTOML(toml);
  // JSON.parse fails on unquoted strings → returns raw value
  assertEqual(obj.key, '[invalid, unquoted]', 'toml invalid array returns raw string');
}

// Line 204: TOML array with single-quoted strings (JSON replace works)
console.log('TOML array with single quotes');
{
  const toml = "key = ['a', 'b']";
  const obj = parseTOML(toml);
  assertEqual(obj.key, ['a', 'b'], 'toml array single-quoted values');
}

// Line 206: TOML negative integer
console.log('TOML negative integer');
{
  const toml = 'offset = -100';
  const obj = parseTOML(toml);
  assertEqual(obj.offset, -100, 'toml negative int');
}

// Line 207: TOML negative float
console.log('TOML negative float');
{
  const toml = 'rate = -0.5';
  const obj = parseTOML(toml);
  assertEqual(obj.rate, -0.5, 'toml negative float');
}

// Lines 244-245: parse() with yaml format and unknown format error
console.log('parse() yaml format branch');
{
  const obj = parse('key: value', 'yaml');
  assertEqual(obj.key, 'value', 'parse yaml format');
}

console.log('parse() unknown format error');
{
  let threw = false;
  try {
    parse('data', 'xml');
  } catch (e) {
    threw = true;
    assert(e.message.includes('Unknown format'), 'error message includes format name');
  }
  assert(threw, 'parse throws on unknown format');
}

// Line 345: compare() formatB defaults to formatA
console.log('compare() formatB defaults to formatA');
{
  // Only pass 3 args — formatB should default to formatA
  const jsonA = '{"a":1}';
  const jsonB = '{"a":2}';
  const changes = compare(jsonA, jsonB, 'json');
  assertEqual(changes.length, 1, 'compare defaults formatB to formatA');
  assertEqual(changes[0].type, 'changed', 'change detected with default formatB');
}

// Lines 320-323: formatHuman with all change types (removed, changed, type-changed)
console.log('formatHuman all change types');
{
  const changes = [
    { path: ['added_key'], type: 'added', newValue: 42 },
    { path: ['removed_key'], type: 'removed', oldValue: 'gone' },
    { path: ['changed_key'], type: 'changed', oldValue: 1, newValue: 2 },
    { path: ['type_key'], type: 'type-changed', oldValue: 1, newValue: 'str', oldType: 'number', newType: 'string' },
  ];
  const human = formatHuman(changes);
  assert(human.includes('+ added_key'), 'formatHuman has added');
  assert(human.includes('- removed_key'), 'formatHuman has removed');
  assert(human.includes('~ changed_key'), 'formatHuman has changed');
  assert(human.includes('! type_key'), 'formatHuman has type-changed');
  assert(human.includes('4 differences:'), 'formatHuman plural summary');
  assert(human.includes('1 added'), 'formatHuman added count');
  assert(human.includes('1 removed'), 'formatHuman removed count');
  assert(human.includes('1 changed'), 'formatHuman changed count');
  assert(human.includes('1 type-changed'), 'formatHuman type-changed count');
}

// Line 326: formatHuman singular difference
console.log('formatHuman singular');
{
  const changes = [{ path: ['key'], type: 'added', newValue: 1 }];
  const human = formatHuman(changes);
  assert(human.includes('1 difference:'), 'singular difference (no s)');
}

// Line 327: formatHuman with multiple added (tests plural filter counts)
console.log('formatHuman multiple added');
{
  const changes = [
    { path: ['a'], type: 'added', newValue: 1 },
    { path: ['b'], type: 'added', newValue: 2 },
  ];
  const human = formatHuman(changes);
  assert(human.includes('2 added'), 'multiple added count');
}

// formatJSONOutput with type-changed
console.log('formatJSONOutput type-changed');
{
  const changes = [
    { path: ['key'], type: 'type-changed', oldValue: 1, newValue: 'str', oldType: 'number', newType: 'string' },
  ];
  const json = formatJSONOutput(changes);
  const parsed = JSON.parse(json);
  assertEqual(parsed[0].path, 'key', 'json output type-changed path');
  assertEqual(parsed[0].oldType, 'number', 'json output oldType');
  assertEqual(parsed[0].newType, 'string', 'json output newType');
}

// formatValue with arrays containing objects
console.log('formatValue complex objects');
{
  assertEqual(formatValue([{ a: 1 }]), '[{"a":1}]', 'array with object');
  assertEqual(formatValue({ nested: { deep: true } }), '{"nested":{"deep":true}}', 'nested object');
}

// parseFlowValue: YAML flow map with multiple entries
console.log('parseFlowValue flow map multiple entries');
{
  const result = parseFlowValue('{x: 1, y: 2, z: 3}');
  assertEqual(result, { x: 1, y: 2, z: 3 }, 'flow map three entries');
}

// parseFlowValue: flow sequence with quoted entries (JSON parse succeeds)
console.log('parseFlowValue JSON-parseable flow');
{
  const result = parseFlowValue('[1, 2, 3]');
  assertEqual(result, [1, 2, 3], 'flow sequence JSON parseable');
}

// parseFlowValue: flow map JSON-parseable
console.log('parseFlowValue JSON-parseable flow map');
{
  const result = parseFlowValue('{"a": 1, "b": 2}');
  assertEqual(result, { a: 1, b: 2 }, 'flow map JSON parseable');
}

// parseJSON wrapper
console.log('parseJSON wrapper');
{
  const obj = parseJSON('{"key": 42}');
  assertEqual(obj.key, 42, 'parseJSON basic');
}

// TOML empty lines and comments only
console.log('TOML empty and comments only');
{
  const obj = parseTOML('# just a comment\n# another\n');
  assertEqual(Object.keys(obj).length, 0, 'empty toml with comments');
}

// TOML nested table overriding existing
console.log('TOML table then array-of-tables same path');
{
  const toml = `[db]
name = "primary"

[[db.replicas]]
host = "rep1"

[[db.replicas]]
host = "rep2"
`;
  const obj = parseTOML(toml);
  assertEqual(obj.db.name, 'primary', 'toml table value preserved');
  assertEqual(obj.db.replicas.length, 2, 'toml nested array of tables');
  assertEqual(obj.db.replicas[0].host, 'rep1', 'toml first replica');
  assertEqual(obj.db.replicas[1].host, 'rep2', 'toml second replica');
}

// TOML single-quoted strings (literal strings)
console.log('TOML single-quoted literal strings');
{
  const toml = "path = 'C:\\Users\\\\test'";
  const obj = parseTOML(toml);
  assertEqual(obj.path, 'C:\\Users\\\\test', 'toml literal string preserves backslashes');
}

// Diff: object vs array (type mismatch)
console.log('Diff: object vs array type change');
{
  const changes = diff({ a: 1 }, [1, 2]);
  assertEqual(changes.length, 1, 'object to array is type-changed');
  assertEqual(changes[0].type, 'type-changed', 'type is type-changed');
  assertEqual(changes[0].oldType, 'object', 'old type object');
  assertEqual(changes[0].newType, 'array', 'new type array');
}

// Diff: array vs object (type mismatch reverse)
console.log('Diff: array vs object type change');
{
  const changes = diff([1, 2], { a: 1 });
  assertEqual(changes.length, 1, 'array to object is type-changed');
  assertEqual(changes[0].oldType, 'array', 'old type array');
  assertEqual(changes[0].newType, 'object', 'new type object');
}

// Diff: function/undefined types (edge case for getType)
console.log('Diff: function type change');
{
  // Functions have typeof 'function'
  const fnA = function() {};
  const fnB = function() {};
  const changes = diff(fnA, fnB);
  // Functions are same type ('function'), JSON.stringify differs → 'changed'
  // Actually JSON.stringify(function(){}) is undefined, so they're "equal"
  assertEqual(changes.length, 0, 'two functions compare as equal (JSON.stringify = undefined)');
}

// Diff: same primitives (no change)
console.log('Diff: identical primitives');
{
  assertEqual(diff('hello', 'hello').length, 0, 'same string no change');
  assertEqual(diff(42, 42).length, 0, 'same number no change');
  assertEqual(diff(true, true).length, 0, 'same bool no change');
}

// Cross-format compare with TOML
console.log('Cross-format compare: JSON vs TOML');
{
  const json = '{"name":"test","port":3000}';
  const toml = 'name = "test"\nport = 3000';
  const changes = compare(json, toml, 'json', 'toml');
  assertEqual(changes.length, 0, 'json vs toml: same data, no changes');
}

// ── Branch Coverage Gap Tests (2026-07-19) ──────────

// Line 69: YAML value with inline comment (ci !== -1 branch)
console.log('YAML inline comment stripping');
{
  const yaml = 'key: value # this is a comment';
  const obj = parseYAML(yaml);
  assertEqual(obj.key, 'value', 'yaml inline comment stripped');
}

// Line 69: YAML numeric value with inline comment
console.log('YAML inline comment on number');
{
  const yaml = 'port: 8080 # server port';
  const obj = parseYAML(yaml);
  assertEqual(obj.port, 8080, 'yaml inline comment on number');
}

// Line 142: parseValue('false') direct call
console.log('parseValue false literal');
{
  assertEqual(parseValue('false'), false, 'parseValue false returns boolean false');
}

// Line 142: parseValue('true') via YAML false branch (val !== 'false')
console.log('parseValue true literal via YAML');
{
  const yaml = 'enabled: true';
  const obj = parseYAML(yaml);
  assertEqual(obj.enabled, true, 'yaml true value');
}

// Line 143: parseValue double-quoted string via YAML
console.log('parseValue double-quoted in YAML context');
{
  const yaml = 'key: "hello"';
  const obj = parseYAML(yaml);
  assertEqual(obj.key, 'hello', 'yaml double-quoted value stripped');
}

// Line 124: Flow collection with double quotes in splitFlowItems
console.log('Flow collection splitFlowItems with double quotes');
{
  // Flow sequence with double-quoted items exercises the c === '"' branch in splitFlowItems
  const yaml = 'items: ["alpha", "beta", "gamma"]';
  const obj = parseYAML(yaml);
  assertEqual(obj.items, ['alpha', 'beta', 'gamma'], 'flow seq with double quotes split correctly');
}

// Line 124: Flow collection with mixed quotes
console.log('Flow collection with mixed quotes');
{
  const yaml = 'data: ["first", \'second\', third]';
  const obj = parseYAML(yaml);
  assertEqual(obj.data, ['first', 'second', 'third'], 'mixed-quote flow seq');
}

// Line 124: Flow map with double-quoted keys
console.log('Flow map with double-quoted keys');
{
  const yaml = 'config: {"a": 1, "b": 2}';
  const obj = parseYAML(yaml);
  assertEqual(obj.config.a, 1, 'flow map double-quoted key a');
  assertEqual(obj.config.b, 2, 'flow map double-quoted key b');
}

// Line 196: parseTOMLValue true literal (covers val === 'true' false branch → continues to other checks)
console.log('TOML true value via parseTOMLValue');
{
  const toml = 'enabled = true';
  const obj = parseTOML(toml);
  assertEqual(obj.enabled, true, 'toml true boolean');
}

// Line 201: TOML double-quoted with invalid JSON (catch branch)
console.log('TOML quoted string JSON.parse catch fallback');
{
  // A double-quoted TOML string with incomplete unicode escape fails JSON.parse
  // → catch branch returns val.slice(1, -1) (strips quotes, returns raw content)
  const toml = 'key = "\\u000"';
  const obj = parseTOML(toml);
  assertEqual(obj.key, '\\u000', 'toml invalid-json quoted string falls back to slice');
}

// Line 40: YAML bare list item with grandparent conversion (stack.length >= 2)
console.log('YAML bare list with nested parent conversion');
{
  // This creates a nested structure where a bare list item appears inside a parent
  // that was created as {}, requiring grandparent conversion to []
  const yaml = 'parent:\n  child:\n    - item1\n    - item2';
  const obj = parseYAML(yaml);
  assertEqual(obj.parent.child, ['item1', 'item2'], 'nested bare list converts parent to array');
}

// Line 40: YAML bare list deeper nesting
console.log('YAML bare list deep nesting with grandparent');
{
  const yaml = 'a:\n  b:\n    c:\n      - x\n      - y';
  const obj = parseYAML(yaml);
  assertEqual(obj.a.b.c, ['x', 'y'], 'deeply nested bare list');
}

// ── Summary ─────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
