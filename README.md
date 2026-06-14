# diff-quick

Zero-dependency text and array diffing using the Myers O(ND) algorithm. No external libraries, no bloat — just clean diffs.

## Why?

Every project needs diffing eventually — comparing configs, generating changelogs, showing what changed. Most diff libraries pull in dependencies or are overkill for simple use cases. `diff-quick` gives you the classic Myers algorithm in a single file with zero dependencies.

## Install

```bash
npm install diff-quick
```

## Quick Start

```js
const { diffLines, diffChars, unifiedDiff } = require('diff-quick');

// Line-level diff
const ops = diffLines('hello\nworld\nfoo', 'hello\nearth\nfoo');
// → [
//   { type: 'equal',   value: 'hello' },
//   { type: 'delete',  value: 'world' },
//   { type: 'insert',  value: 'earth' },
//   { type: 'equal',   value: 'foo' }
// ]

// Character-level diff
diffChars('abc', 'axc');
// → [equal:a, delete:b, insert:x, equal:c]

// Unified diff format
console.log(unifiedDiff('a\nb\nc', 'a\nx\nc'));
// --- a
// +++ b
// @@ -1,3 +1,3 @@
//  a
// -b
// +x
//  c
```

## API

### Core

#### `myers(a, b, eq?)`
The raw Myers shortest-edit-script algorithm. Returns `[{type, value}]` where type is `'equal'`, `'insert'`, or `'delete'`.

```js
const { myers } = require('diff-quick');

myers([1, 2, 3], [1, 3]);
// → [equal:1, delete:2, equal:3]

// Custom equality
myers(
  [{ id: 1, name: 'a' }],
  [{ id: 1, name: 'b' }],
  (a, b) => a.id === b.id  // same ID = equal
);
```

#### `diffArrays(a, b, eq?)`
Alias for `myers()`. Diff any two arrays with an optional equality predicate.

### Diff Functions

| Function | Granularity | Example |
|----------|-------------|---------|
| `diffLines(a, b)` | Line-by-line | `'foo\nbar'` → split on `\n` |
| `diffChars(a, b)` | Character-by-character | `'abc'` → split on `''` |
| `diffWords(a, b)` | Word-by-word | Preserves whitespace tokens |
| `diffSentences(a, b)` | Sentence-by-sentence | Splits on `.`, `!`, `?` |
| `diffJson(a, b, basePath?)` | Structural JSON diff | Returns RFC 6902-style patches |

```js
const { diffWords, diffJson } = require('diff-quick');

diffWords('the quick fox', 'the lazy fox');
// → [equal:the, equal: , delete:quick, insert:lazy, equal: , equal:fox]

diffJson({ a: 1, b: 2 }, { a: 1, c: 3 });
// → [
//   { op: 'remove', path: '/b' },
//   { op: 'add', path: '/c', value: 3 }
// ]
```

### Unified Diff

#### `unifiedDiff(a, b, opts?)`
Generate unified diff format output.

```js
unifiedDiff('line1\nline2\nline3', 'line1\nline2mod\nline3', {
  from: 'original.txt',
  to: 'modified.txt',
  context: 3
});
```

#### `createPatch(a, b, opts?)`
Returns a structured patch object `{ from, to, raw }`.

#### `applyPatch(original, patchText)`
Apply a unified diff back to the original text.

```js
const patch = unifiedDiff(original, modified);
const restored = applyPatch(original, patch);
// restored === modified
```

### Stats & Formatting

#### `diffStats(ops)`
```js
const stats = diffStats(ops);
// { additions: 5, deletions: 3, changes: 8 }
```

#### Formatters
- `formatColor(ops)` — ANSI-colored terminal output
- `formatPlain(ops)` — Plain text with `+`/`-`/` ` prefixes
- `formatHtml(ops)` — HTML with `<ins>`/`<del>` tags

### LCS

#### `lcs(a, b, eq?)`
Longest Common Subsequence (classic DP approach).

```js
lcs('ABCBDAB'.split(''), 'BDCAB'.split(''));
// → ['B', 'D', 'A', 'B']  (length 4)
```

## CLI

```bash
# Line diff (colored by default)
diff-quick lines "hello world" "hello earth"

# Unified diff
diff-quick unified file1.txt file2.txt

# Character diff
diff-quick chars "abc" "axc"

# JSON structural diff
diff-quick json '{"a":1}' '{"a":2,"b":3}'

# Stats only
diff-quick stats file1.txt file2.txt

# Apply a patch
diff-quick apply "$(diff-quick unified orig.txt mod.txt)" < orig.txt

# Output formats
diff-quick lines a.txt b.txt --format json
diff-quick lines a.txt b.txt --format text
diff-quick lines a.txt b.txt --format html
```

## How It Works

The Myers algorithm finds the **shortest edit script** (SES) between two sequences. It works on the "edit graph" — a grid where moving right = delete from A, moving down = insert from B, and moving diagonally = match (equal elements).

The key insight: the algorithm searches along diagonals in increasing order of edit distance `d`. For each `d`, it explores all possible diagonals `k` (where `k = x - y`) and finds the furthest-reaching point. When both pointers reach the end, we have the shortest script.

Time complexity: **O(ND)** where N = total length, D = edit distance. For similar texts (small D), this is nearly linear.

## Zero Dependencies

No `node_modules`. No transitive deps. Just one file.

## License

MIT
