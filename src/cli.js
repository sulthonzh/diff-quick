#!/usr/bin/env node
'use strict';

const {
  diffArrays, diffLines, diffChars, diffWords, diffSentences,
  diffJson, unifiedDiff, createPatch, applyPatch,
  diffStats, formatColor, formatPlain, formatHtml,
} = require('./index');

const args = process.argv.slice(2);

function usage() {
  console.log(`diff-quick — Zero-dependency diff using Myers algorithm

USAGE
  diff-quick <command> [options]

COMMANDS
  lines <a> <b>       Diff two strings line-by-line
  chars <a> <b>       Diff two strings character-by-character
  words <a> <b>       Diff two strings word-by-word
  sentences <a> <b>   Diff two strings sentence-by-sentence
  unified <a> <b>     Output unified diff format
  json <a> <b>        Diff two JSON values (RFC 6902 style patches)
  stats <a> <b>       Show diff statistics only
  apply <patch>       Apply unified diff patch (reads original from stdin)
  help                Show this message

OPTIONS
  --from <name>       Filename for 'from' header (unified)
  --to <name>         Filename for 'to' header (unified)
  --context <n>       Lines of context (default: 3, unified)
  --format <fmt>      Output format: text, color, html, json (default: color)
  --no-color          Disable ANSI colors (same as --format text)

EXAMPLES
  diff-quick lines "hello\\nworld" "hello\\nearth"
  diff-quick unified file1.txt file2.txt --from original --from modified
  cat original.txt | diff-quick apply "$(diff-quick unified orig.txt mod.txt)"

Stdin: if only one argument is provided for lines/chars/words/sentences/unified,
the first input is read from stdin.`);
}

function readStdin() {
  return require('fs').readFileSync(0, 'utf8');
}

// Parse flags
const opts = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--from') { opts.from = args[++i]; continue; }
  if (args[i] === '--to') { opts.to = args[++i]; continue; }
  if (args[i] === '--context') { opts.context = parseInt(args[++i], 10); continue; }
  if (args[i] === '--format') { opts.format = args[++i]; continue; }
  if (args[i] === '--no-color') { opts.format = 'text'; continue; }
  if (args[i] === '--json') { opts.format = 'json'; continue; }
  if (args[i] === '--help' || args[i] === '-h') { usage(); process.exit(0); }
  positional.push(args[i]);
}

const command = positional[0];

if (!command || command === 'help') {
  usage();
  process.exit(0);
}

const fmt = opts.format || 'color';

function getInputs() {
  let a, b;
  if (positional.length >= 3) {
    a = positional[1];
    b = positional[2];
  } else if (positional.length === 2) {
    // Read first from stdin
    a = readStdin();
    b = positional[1];
  } else {
    console.error('Error: need two inputs (provide as args or pipe via stdin)');
    process.exit(1);
  }
  return [a, b];
}

function outputOps(ops) {
  if (fmt === 'json') {
    console.log(JSON.stringify(ops));
  } else if (fmt === 'html') {
    console.log(formatHtml(ops));
  } else if (fmt === 'text') {
    console.log(formatPlain(ops));
  } else {
    console.log(formatColor(ops));
  }
}

switch (command) {
  case 'lines': {
    const [a, b] = getInputs();
    outputOps(diffLines(a, b));
    break;
  }
  case 'chars': {
    const [a, b] = getInputs();
    outputOps(diffChars(a, b));
    break;
  }
  case 'words': {
    const [a, b] = getInputs();
    outputOps(diffWords(a, b));
    break;
  }
  case 'sentences': {
    const [a, b] = getInputs();
    outputOps(diffSentences(a, b));
    break;
  }
  case 'unified': {
    const [a, b] = getInputs();
    const result = unifiedDiff(a, b, opts);
    console.log(result);
    break;
  }
  case 'json': {
    const [a, b] = getInputs();
    let valA, valB;
    try { valA = JSON.parse(a); } catch { valA = a; }
    try { valB = JSON.parse(b); } catch { valB = b; }
    const patches = diffJson(valA, valB);
    console.log(JSON.stringify(patches, null, 2));
    break;
  }
  case 'stats': {
    const [a, b] = getInputs();
    const ops = diffLines(a, b);
    const stats = diffStats(ops);
    if (fmt === 'json') {
      console.log(JSON.stringify(stats));
    } else {
      console.log(`+${stats.additions} -${stats.deletions} (${stats.changes} changes)`);
    }
    break;
  }
  case 'apply': {
    const patchText = positional[1] || readStdin();
    const original = readStdin();
    const result = applyPatch(original, patchText);
    process.stdout.write(result);
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
}
