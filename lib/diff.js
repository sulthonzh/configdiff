'use strict';

const { execFileSync } = require('child_process');

// ── Version ─────────────────────────────────────────────

const VERSION = '1.1.0';

// ── Parsers ──────────────────────────────────────────────

function parseJSON(text) {
  return JSON.parse(text);
}

function parseYAML(text) {
  const result = {};
  const lines = text.split('\n');
  const stack = [{ obj: result, indent: -1, key: null }];

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.length - trimmed.length;

    // Pop stack to find parent at lower indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    // Bare list item: "- value"
    const bareList = trimmed.match(/^- (.+)$/);
    // Key-value: "key: value" or "- key: value"
    const kvMatch = trimmed.match(/^(?:- )?(.+?):\s*(.*)?$/);

    if (bareList && !kvMatch) {
      const parent = stack[stack.length - 1];
      const container = parent.obj;
      const val = parseValue(bareList[1].trim());
      // If the parent was created as {} for this key, convert to array
      if (parent.key !== null && typeof container === 'object' && !Array.isArray(container)) {
        const grandparent = stack.length >= 2 ? stack[stack.length - 2].obj : null;
        if (grandparent && parent.key in grandparent) {
          grandparent[parent.key] = [];
          grandparent[parent.key].push(val);
          stack[stack.length - 1].obj = grandparent[parent.key];
        }
      } else if (Array.isArray(container)) {
        container.push(val);
      }
    } else if (kvMatch) {
      const parent = stack[stack.length - 1].obj;
      const isListItem = trimmed.startsWith('- ');
      const key = kvMatch[1];
      let val = kvMatch[2];

      if (val === undefined || val === '' || val === '|' || val === '>') {
        // Nested — push new scope
        if (isListItem) {
          if (!Array.isArray(parent[key])) parent[key] = [];
          const child = {};
          parent[key].push(child);
          stack.push({ obj: child, indent, key });
        } else {
          parent[key] = {};
          stack.push({ obj: parent[key], indent, key });
        }
      } else {
        val = val.trim();
        const ci = val.indexOf(' #');
        if (ci !== -1) val = val.slice(0, ci).trim();

        if (isListItem) {
          if (!Array.isArray(parent[key])) parent[key] = [];
          parent[key].push(parseValue(val));
        } else {
          parent[key] = parseValue(val);
        }
      }
    }
  }
  return result;
}

function parseFlowValue(val) {
  // YAML flow sequence: [a, b, c] or [1, 2, 3] or ["a", "b"]
  if (val.startsWith('[') && val.endsWith(']')) {
    const inner = val.slice(1, -1).trim();
    if (!inner) return [];
    // Try JSON first (handles quoted strings)
    try { return JSON.parse(val); } catch {}
    // Parse unquoted YAML flow sequence
    const items = splitFlowItems(inner);
    return items.map(item => parseValue(item.trim()));
  }
  // YAML flow mapping: {a: 1, b: 2}
  if (val.startsWith('{') && val.endsWith('}')) {
    const inner = val.slice(1, -1).trim();
    if (!inner) return {};
    // Try JSON first
    try { return JSON.parse(val); } catch {}
    // Parse unquoted YAML flow mapping
    const result = {};
    const pairs = splitFlowItems(inner);
    for (const pair of pairs) {
      const ci = pair.indexOf(':');
      if (ci !== -1) {
        const k = pair.slice(0, ci).trim().replace(/^["']|["']$/g, '');
        const v = pair.slice(ci + 1).trim();
        result[k] = parseValue(v);
      }
    }
    return result;
  }
  return undefined; // not a flow value
}

// Split flow items respecting nested brackets and quotes
function splitFlowItems(str) {
  const items = [];
  let depth = 0;
  let inSingle = false, inDouble = false;
  let start = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (!inSingle && !inDouble) {
      if (c === '[' || c === '{') depth++;
      else if (c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) {
        items.push(str.slice(start, i));
        start = i + 1;
      }
    }
  }
  if (start < str.length) items.push(str.slice(start));
  return items;
}

function parseValue(val) {
  if (val === 'null' || val === '~') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
  if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  // YAML flow collections
  if (val.startsWith('[') && val.endsWith(']') || val.startsWith('{') && val.endsWith('}')) {
    const flow = parseFlowValue(val);
    if (flow !== undefined) return flow;
  }
  return val;
}

function parseTOML(text) {
  const result = {};
  const lines = text.split('\n');
  let current = result;
  let currentPath = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const tableMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
      currentPath = tableMatch[1].split('.').map(s => s.trim());
      current = navigateOrCreate(result, currentPath);
      continue;
    }

    const arrayTableMatch = trimmed.match(/^\[\[([^\]]+)\]\]$/);
    if (arrayTableMatch) {
      currentPath = arrayTableMatch[1].split('.').map(s => s.trim());
      const arr = navigateOrCreate(result, currentPath, true);
      const obj = {};
      arr.push(obj);
      current = obj;
      continue;
    }

    const kvMatch = trimmed.match(/^([^=]+?)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let val = kvMatch[2].trim();
      const ci = val.indexOf(' #');
      if (ci !== -1) val = val.slice(0, ci).trim();
      current[key] = parseTOMLValue(val);
    }
  }
  return result;
}

function parseTOMLValue(val) {
  if (val === 'null') return null;
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val.startsWith('"""') && val.endsWith('"""')) return val.slice(3, -3);
  if (val.startsWith("'''") && val.endsWith("'''")) return val.slice(3, -3);
  if (val.startsWith('"') && val.endsWith('"')) {
    try { return JSON.parse(val); } catch { return val.slice(1, -1); }
  }
  if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
  if (val.startsWith('[')) {
    try { return JSON.parse(val.replace(/'/g, '"')); } catch { return val; }
  }
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  return val;
}

function navigateOrCreate(obj, path, asArray) {
  let current = obj;
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (i === path.length - 1) {
      if (asArray) {
        if (!Array.isArray(current[key])) current[key] = [];
        return current[key];
      }
      if (current[key] === undefined) current[key] = {};
      return current[key];
    }
    if (current[key] === undefined) current[key] = {};
    current = current[key];
  }
  return current;
}

// ── Format Detection ────────────────────────────────────

function detectFormat(filePath) {
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return 'yaml';
  if (filePath.endsWith('.toml')) return 'toml';
  return null;
}

function parse(text, format) {
  switch (format) {
    case 'json': return parseJSON(text);
    case 'yaml': return parseYAML(text);
    case 'toml': return parseTOML(text);
    default: throw new Error(`Unknown format: ${format}. Use .json, .yaml, .yml, or .toml files.`);
  }
}

// ── Semantic Diff Engine ────────────────────────────────

function getType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

function diff(a, b, path) {
  path = path || [];
  const changes = [];
  const typeA = getType(a);
  const typeB = getType(b);

  if (typeA === 'object' && typeB === 'object') {
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of allKeys) {
      const cp = [...path, key];
      if (!(key in b)) {
        changes.push({ path: cp, type: 'removed', oldValue: a[key] });
      } else if (!(key in a)) {
        changes.push({ path: cp, type: 'added', newValue: b[key] });
      } else {
        changes.push(...diff(a[key], b[key], cp));
      }
    }
    return changes;
  }

  if (typeA === 'array' && typeB === 'array') {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const cp = [...path, i];
      if (i >= a.length) {
        changes.push({ path: cp, type: 'added', newValue: b[i] });
      } else if (i >= b.length) {
        changes.push({ path: cp, type: 'removed', oldValue: a[i] });
      } else {
        changes.push(...diff(a[i], b[i], cp));
      }
    }
    return changes;
  }

  if (typeA !== typeB) {
    changes.push({ path, type: 'type-changed', oldValue: a, newValue: b, oldType: typeA, newType: typeB });
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    changes.push({ path, type: 'changed', oldValue: a, newValue: b });
  }

  return changes;
}

// ── Output Formatters ───────────────────────────────────

function formatPath(pathArr) {
  return pathArr.map(p => typeof p === 'number' ? `[${p}]` : p).join('.');
}

function formatValue(val) {
  if (val === null) return 'null';
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function formatHuman(changes) {
  if (changes.length === 0) return 'No differences found.';
  const lines = [];
  for (const c of changes) {
    const p = formatPath(c.path);
    switch (c.type) {
      case 'added': lines.push(`+ ${p} = ${formatValue(c.newValue)}`); break;
      case 'removed': lines.push(`- ${p} (${formatValue(c.oldValue)})`); break;
      case 'changed': lines.push(`~ ${p}: ${formatValue(c.oldValue)} → ${formatValue(c.newValue)}`); break;
      case 'type-changed': lines.push(`! ${p}: [${c.oldType}] ${formatValue(c.oldValue)} → [${c.newType}] ${formatValue(c.newValue)}`); break;
    }
  }
  const summary = `\n${changes.length} difference${changes.length > 1 ? 's' : ''}: ` +
    `${changes.filter(c => c.type === 'added').length} added, ` +
    `${changes.filter(c => c.type === 'removed').length} removed, ` +
    `${changes.filter(c => c.type === 'changed').length} changed, ` +
    `${changes.filter(c => c.type === 'type-changed').length} type-changed`;
  return lines.join('\n') + summary;
}

function formatJSONOutput(changes) {
  return JSON.stringify(changes.map(c => {
    const { path: rawPath, ...rest } = c;
    return { path: formatPath(rawPath), ...rest };
  }), null, 2);
}

// ── Main API ────────────────────────────────────────────

function compare(textA, textB, formatA, formatB) {
  formatB = formatB || formatA;
  const a = parse(textA, formatA);
  const b = parse(textB, formatB);
  return diff(a, b);
}

module.exports = {
  VERSION,
  parse, diff, compare, detectFormat,
  formatHuman, formatJSONOutput,
  formatPath, formatValue,
  parseJSON, parseYAML, parseTOML,
  parseValue, parseFlowValue,
};
