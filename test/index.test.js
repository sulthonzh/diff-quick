'use strict';

const { myers, diffArrays, diffLines, diffChars, diffWords, diffSentences,
  diffJson, unifiedDiff, createPatch, applyPatch, diffStats,
  formatColor, formatPlain, formatHtml, lcs } = require('../src/index');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`  ✗ ${msg}\n    expected: ${e}\n    got:      ${a}`); }
}

// ─── Myers core ──────────────────────────────────────────────────────────────

console.log('Myers core algorithm');

// Empty arrays
assertDeepEqual(myers([], []), [], 'empty → empty');
assertDeepEqual(
  myers([], ['a']),
  [{ type: 'insert', value: 'a' }],
  'empty → a'
);
assertDeepEqual(
  myers(['a'], []),
  [{ type: 'delete', value: 'a' }],
  'a → empty'
);

// Identical arrays
assertDeepEqual(
  myers(['a', 'b', 'c'], ['a', 'b', 'c']),
  [
    { type: 'equal', value: 'a' },
    { type: 'equal', value: 'b' },
    { type: 'equal', value: 'c' },
  ],
  'identical arrays'
);

// Simple insert
assertDeepEqual(
  myers(['a', 'c'], ['a', 'b', 'c']),
  [
    { type: 'equal', value: 'a' },
    { type: 'insert', value: 'b' },
    { type: 'equal', value: 'c' },
  ],
  'insert in middle'
);

// Simple delete
assertDeepEqual(
  myers(['a', 'b', 'c'], ['a', 'c']),
  [
    { type: 'equal', value: 'a' },
    { type: 'delete', value: 'b' },
    { type: 'equal', value: 'c' },
  ],
  'delete in middle'
);

// Replace
assertDeepEqual(
  myers(['a', 'x', 'c'], ['a', 'y', 'c']),
  [
    { type: 'equal', value: 'a' },
    { type: 'delete', value: 'x' },
    { type: 'insert', value: 'y' },
    { type: 'equal', value: 'c' },
  ],
  'replace middle element'
);

// Complete replacement
assertDeepEqual(
  myers([1, 2], [3, 4]),
  [
    { type: 'delete', value: 1 },
    { type: 'delete', value: 2 },
    { type: 'insert', value: 3 },
    { type: 'insert', value: 4 },
  ],
  'complete replacement'
);

// Custom equality
assertDeepEqual(
  myers([{ id: 1 }], [{ id: 1, extra: true }], (a, b) => a.id === b.id),
  [{ type: 'equal', value: { id: 1 } }],
  'custom equality predicate'
);

// Larger sequence
const ops1 = myers(
  ['the', 'quick', 'brown', 'fox'],
  ['the', 'lazy', 'brown', 'dog']
);
const types1 = ops1.map((o) => o.type + ':' + o.value);
assert(types1.includes('delete:quick'), 'larger diff has delete quick');
assert(types1.includes('insert:lazy'), 'larger diff has insert lazy');
assert(types1.includes('equal:brown'), 'larger diff keeps brown');

// ─── diffLines ───────────────────────────────────────────────────────────────

console.log('diffLines');

const textA = 'line1\nline2\nline3';
const textB = 'line1\nline2modified\nline3';
const lineOps = diffLines(textA, textB);
assert(lineOps.length === 4, 'line diff produces 4 ops');
assert(lineOps.some((o) => o.type === 'delete' && o.value === 'line2'), 'line diff deletes line2');
assert(lineOps.some((o) => o.type === 'insert' && o.value === 'line2modified'), 'line diff inserts line2modified');

// Multi-line
const longA = 'a\nb\nc\nd\ne\nf\ng';
const longB = 'a\nb\nx\nd\ne\ny\ng';
const longOps = diffLines(longA, longB);
assert(longOps.some((o) => o.type === 'delete' && o.value === 'c'), 'multi-line diff deletes c');
assert(longOps.some((o) => o.type === 'insert' && o.value === 'x'), 'multi-line diff inserts x');
assert(longOps.some((o) => o.type === 'delete' && o.value === 'f'), 'multi-line diff deletes f');
assert(longOps.some((o) => o.type === 'insert' && o.value === 'y'), 'multi-line diff inserts y');

// ─── diffChars ───────────────────────────────────────────────────────────────

console.log('diffChars');

const charOps = diffChars('abc', 'axc');
assert(charOps.length === 4, 'char diff produces 4 ops');
assert(charOps[1].type === 'delete' && charOps[1].value === 'b', 'char diff deletes b');
assert(charOps[2].type === 'insert' && charOps[2].value === 'x', 'char diff inserts x');

// ─── diffWords ───────────────────────────────────────────────────────────────

console.log('diffWords');

const wordOps = diffWords('hello world foo', 'hello bar foo');
const wordTypes = wordOps.map((o) => o.type + ':' + o.value);
assert(wordTypes.includes('delete:world'), 'word diff deletes world');
assert(wordTypes.includes('insert:bar'), 'word diff inserts bar');

// ─── diffSentences ───────────────────────────────────────────────────────────

console.log('diffSentences');

const sentOps = diffSentences(
  'Hello world. How are you?',
  'Hello world. Where are you?'
);
const sentTypes = sentOps.map((o) => o.type + ':' + o.value);
assert(sentTypes.some((s) => s.startsWith('delete:') && s.includes('How are you?')), 'sentence diff deletes How');
assert(sentTypes.some((s) => s.startsWith('insert:') && s.includes('Where are you?')), 'sentence diff inserts Where');

// ─── diffJson ────────────────────────────────────────────────────────────────

console.log('diffJson');

// Primitive change
const jp1 = diffJson(42, 99);
assert(jp1.length === 1 && jp1[0].op === 'replace', 'json diff primitive replace');

// Object property added
const jp2 = diffJson({ a: 1 }, { a: 1, b: 2 });
assert(jp2.length === 1 && jp2[0].op === 'add' && jp2[0].path === '/b', 'json diff add property');

// Object property removed
const jp3 = diffJson({ a: 1, b: 2 }, { a: 1 });
assert(jp3.length === 1 && jp3[0].op === 'remove' && jp3[0].path === '/b', 'json diff remove property');

// Object property replaced
const jp4 = diffJson({ a: 1 }, { a: 2 });
assert(jp4.length === 1 && jp4[0].op === 'replace' && jp4[0].path === '/a', 'json diff replace property');

// No change
const jp5 = diffJson({ a: 1 }, { a: 1 });
assert(jp5.length === 0, 'json diff no change');

// ─── unifiedDiff ─────────────────────────────────────────────────────────────

console.log('unifiedDiff');

const ud1 = unifiedDiff('a\nb\nc', 'a\nx\nc');
assert(ud1.includes('--- '), 'unified diff has --- header');
assert(ud1.includes('+++ '), 'unified diff has +++ header');
assert(ud1.includes('@@'), 'unified diff has hunk header');
assert(ud1.includes('-b'), 'unified diff has -b');
assert(ud1.includes('+x'), 'unified diff has +x');

// Same text → minimal output
const ud2 = unifiedDiff('same', 'same');
assert(!ud2.includes('@@'), 'identical text has no hunks');

// ─── applyPatch ──────────────────────────────────────────────────────────────

console.log('applyPatch');

const orig = 'line1\nline2\nline3';
const patch = unifiedDiff(orig, 'line1\nline2mod\nline3');
const restored = applyPatch(orig, patch);
assert(restored === 'line1\nline2mod\nline3', 'applyPatch round-trip');

// Multi-change patch
const orig2 = 'a\nb\nc\nd\ne';
const patch2 = unifiedDiff(orig2, 'a\nB\nc\nD\ne');
const restored2 = applyPatch(orig2, patch2);
assert(restored2 === 'a\nB\nc\nD\ne', 'applyPatch multi-change');

// ─── diffStats ───────────────────────────────────────────────────────────────

console.log('diffStats');

const testOps = [
  { type: 'equal', value: 'x' },
  { type: 'insert', value: 'a' },
  { type: 'insert', value: 'b' },
  { type: 'delete', value: 'c' },
];
const stats = diffStats(testOps);
assert(stats.additions === 2, 'stats additions = 2');
assert(stats.deletions === 1, 'stats deletions = 1');
assert(stats.changes === 3, 'stats changes = 3');

// ─── Formatting ──────────────────────────────────────────────────────────────

console.log('Formatting');

const fmtOps = [
  { type: 'equal', value: 'same' },
  { type: 'insert', value: 'added' },
  { type: 'delete', value: 'gone' },
];

// formatPlain
const plain = formatPlain(fmtOps);
assert(plain.includes('+added'), 'plain format has +added');
assert(plain.includes('-gone'), 'plain format has -gone');
assert(plain.includes(' same'), 'plain format has same');

// formatColor
const colored = formatColor(fmtOps);
assert(colored.includes('\x1b[32m'), 'color format has green');
assert(colored.includes('\x1b[31m'), 'color format has red');
assert(colored.includes('\x1b[0m'), 'color format has reset');

// formatHtml
const html = formatHtml(fmtOps);
assert(html.includes('<ins>'), 'html format has ins');
assert(html.includes('<del>'), 'html format has del');
assert(html.includes('&lt;') === false, 'html format escapes correctly (no special chars here)');

// HTML escaping test
const html2 = formatHtml([{ type: 'insert', value: '<script>' }]);
assert(html2.includes('&lt;script&gt;'), 'html format escapes special chars');

// ─── LCS ─────────────────────────────────────────────────────────────────────

console.log('LCS');

assertDeepEqual(lcs([], []), [], 'lcs empty');
assertDeepEqual(lcs(['a'], []), [], 'lcs one empty');
assertDeepEqual(
  lcs(['a', 'b', 'c'], ['a', 'c']),
  ['a', 'c'],
  'lcs basic'
);
assertDeepEqual(
  lcs('ABCBDAB'.split(''), 'BDCAB'.split('')),
  ['B', 'C', 'A', 'B'],
  'lcs classic example — wait let me check'
);
// Actually LCS of ABCBDAB and BDCAB could be BCAB, BDAB, BCBA... let me verify
// The standard LCS is BCAB or BDAB (length 4)
const lcsResult = lcs('ABCBDAB'.split(''), 'BDCAB'.split(''));
assert(lcsResult.length === 4, 'lcs classic example length = 4');

// ─── diffArrays ──────────────────────────────────────────────────────────────

console.log('diffArrays');

const arrOps = diffArrays([1, 2, 3, 4], [1, 3, 4, 5]);
assert(arrOps.some((o) => o.type === 'delete' && o.value === 2), 'array diff deletes 2');
assert(arrOps.some((o) => o.type === 'insert' && o.value === 5), 'array diff inserts 5');
assert(arrOps.some((o) => o.type === 'equal' && o.value === 3), 'array diff keeps 3');

// Numbers
const numOps = diffArrays([10, 20, 30], [10, 25, 30]);
assert(numOps.some((o) => o.type === 'delete' && o.value === 20), 'num array diff deletes 20');
assert(numOps.some((o) => o.type === 'insert' && o.value === 25), 'num array diff inserts 25');

// ─── createPatch ─────────────────────────────────────────────────────────────

console.log('createPatch');

const cp = createPatch('a\nb', 'a\nc');
assert(cp.from === 'a', 'createPatch from');
assert(cp.to === 'b', 'createPatch to');
assert(typeof cp.raw === 'string', 'createPatch raw is string');

// ─── Edge cases ──────────────────────────────────────────────────────────────

console.log('Edge cases');

// Single element arrays
assertDeepEqual(
  myers([1], [2]),
  [{ type: 'delete', value: 1 }, { type: 'insert', value: 2 }],
  'single element replace'
);

// All same
const allSame = myers([1, 2, 3], [1, 2, 3]);
assert(allSame.every((o) => o.type === 'equal'), 'all equal');

// Reverse
const reversed = myers([1, 2], [2, 1]);
assert(reversed.some((o) => o.type === 'delete'), 'reversed has deletes');
assert(reversed.some((o) => o.type === 'insert'), 'reversed has inserts');

// Large identical
const largeA = Array.from({ length: 100 }, (_, i) => i);
const largeB = Array.from({ length: 100 }, (_, i) => i);
const largeOps = myers(largeA, largeB);
assert(largeOps.length === 100, 'large identical = 100 equal ops');
assert(largeOps.every((o) => o.type === 'equal'), 'large identical all equal');

// Large with one change
const largeC = Array.from({ length: 100 }, (_, i) => (i === 50 ? 999 : i));
const largeOps2 = myers(largeA, largeC);
assert(largeOps2.some((o) => o.type === 'delete' && o.value === 50), 'large diff deletes 50');
assert(largeOps2.some((o) => o.type === 'insert' && o.value === 999), 'large diff inserts 999');

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
