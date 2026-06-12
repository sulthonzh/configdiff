#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { compare, detectFormat, formatHuman, formatJSONOutput } = require('../lib/diff');

const args = process.argv.slice(2);

function usage() {
  console.log(`configdiff — semantic diff for config files

Usage: configdiff <file-a> <file-b> [options]

Options:
  --json    Output as JSON
  --help    Show this help

Supported formats: .json, .yaml/.yml, .toml

Examples:
  configdiff config-old.json config-new.json
  configdiff docker-compose.yml docker-compose.new.yml
  configdiff pyproject.toml pyproject.new.toml --json
`);
}

if (args.includes('--help') || args.length < 2) {
  usage();
  process.exit(args.includes('--help') ? 0 : 1);
}

const fileA = args[0];
const fileB = args[1];
const jsonOutput = args.includes('--json');

if (!fs.existsSync(fileA)) {
  console.error(`Error: ${fileA} not found`);
  process.exit(1);
}
if (!fs.existsSync(fileB)) {
  console.error(`Error: ${fileB} not found`);
  process.exit(1);
}

const formatA = detectFormat(fileA);
const formatB = detectFormat(fileB);

if (!formatA) {
  console.error(`Error: Can't detect format for ${fileA}. Use .json, .yaml, .yml, or .toml`);
  process.exit(1);
}
if (!formatB) {
  console.error(`Error: Can't detect format for ${fileB}. Use .json, .yaml, .yml, or .toml`);
  process.exit(1);
}

const textA = fs.readFileSync(fileA, 'utf-8');
const textB = fs.readFileSync(fileB, 'utf-8');

try {
  const changes = compare(textA, textB, formatA, formatB);

  if (jsonOutput) {
    console.log(formatJSONOutput(changes));
  } else {
    console.log(formatHuman(changes));
  }

  process.exit(changes.length > 0 ? 1 : 0);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(2);
}
