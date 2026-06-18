'use strict';

const fs = require('fs');
const { parse, diff, compare, detectFormat, formatHuman, formatJSONOutput, formatPath, formatValue, parseYAML, parseTOML, VERSION } = require('../lib/diff');

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

// ── Version Export ───────────────────────────────────
console.log('Version export');
{
  assertEqual(VERSION, '1.1.0', 'version string correct');
}

// ── Summary ─────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
