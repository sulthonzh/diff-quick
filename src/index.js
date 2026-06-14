'use strict';

/**
 * diff-quick — Zero-dependency text and array diff using the Myers algorithm.
 *
 * Implements the classic Myers O(ND) shortest-edit-script algorithm,
 * plus convenience wrappers for line-level and word-level diffs,
 * unified diff format output, and patch generation/application.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Myers core: compute shortest edit script (SES) for two arrays
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the Myers shortest edit script between two arrays.
 * Returns an array of { type: 'equal' | 'insert' | 'delete', value } ops.
 *
 * @param {Array} a — "from" array
 * @param {Array} b — "to" array
 * @param {function} [eq] — equality predicate (default Object.is)
 * @returns {Array<{type:string, value:*}>}
 */
function myers(a, b, eq = Object.is) {
  const n = a.length;
  const m = b.length;

  // Trivial cases
  if (n === 0 && m === 0) return [];
  if (n === 0) return b.map((value) => ({ type: 'insert', value }));
  if (m === 0) return a.map((value) => ({ type: 'delete', value }));

  // Trace: store the V array at each step so we can backtrack
  const trace = [];
  const max = n + m;
  // V[k] = furthest x on diagonal k (k ranges from -d to +d)
  // We use an object/array offset by max to handle negative indices
  const vLen = 2 * max + 1;
  let v = new Array(vLen).fill(0);

  let found = false;
  for (let d = 0; d <= max; d++) {
    // Save the current V state for backtracking
    trace.push(v.slice());

    for (let k = -d; k <= d; k += 2) {
      let x;
      // Determine whether to move down (insert) or right (delete)
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max]; // move down (insertion)
      } else {
        x = v[k - 1 + max] + 1; // move right (deletion)
      }

      let y = x - k;

      // Follow diagonal (equal elements)
      while (x < n && y < m && eq(a[x], b[y])) {
        x++;
        y++;
      }

      v[k + max] = x;

      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // Backtrack through the trace to build the edit script
  const ops = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d >= 0; d--) {
    const vPrev = trace[d];
    const k = x - y;

    let prevK;
    if (k === -d || (k !== d && vPrev[k - 1 + max] < vPrev[k + 1 + max])) {
      prevK = k + 1; // came from below (insertion)
    } else {
      prevK = k - 1; // came from left (deletion)
    }

    const prevX = vPrev[prevK + max];
    const prevY = prevX - prevK;

    // Diagonal (equal) moves
    while (x > prevX && y > prevY) {
      ops.push({ type: 'equal', value: a[x - 1] });
      x--;
      y--;
    }

    if (d > 0) {
      if (x === prevX && y > prevY) {
        // Insertion
        ops.push({ type: 'insert', value: b[y - 1] });
        y--;
      } else if (y === prevY && x > prevX) {
        // Deletion
        ops.push({ type: 'delete', value: a[x - 1] });
        x--;
      }
    }
  }

  ops.reverse();
  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience diff functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diff two arrays. Returns list of {type, value} ops.
 * @param {Array} a
 * @param {Array} b
 * @param {function} [eq]
 * @returns {Array<{type:string, value:*}>}
 */
function diffArrays(a, b, eq) {
  return myers(a, b, eq);
}

/**
 * Diff two strings line-by-line.
 * Returns list of {type, value} where value is a line (without newline).
 * @param {string} a
 * @param {string} b
 * @returns {Array<{type:string, value:string}>}
 */
function diffLines(a, b) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  return myers(linesA, linesB);
}

/**
 * Diff two strings character-by-character.
 * @param {string} a
 * @param {string} b
 * @returns {Array<{type:string, value:string}>}
 */
function diffChars(a, b) {
  return myers(a.split(''), b.split(''));
}

/**
 * Diff two strings word-by-word.
 * Words are sequences of non-whitespace; whitespace is preserved as separate tokens.
 * @param {string} a
 * @param {string} b
 * @returns {Array<{type:string, value:string}>}
 */
function diffWords(a, b) {
  const tokenize = (s) => s.match(/\s+|\S+/g) || [];
  return myers(tokenize(a), tokenize(b));
}

/**
 * Diff two strings sentence-by-sentence.
 * @param {string} a
 * @param {string} b
 * @returns {Array<{type:string, value:string}>}
 */
function diffSentences(a, b) {
  const split = (s) => s.match(/[^.!?]+[.!?]+|\S+$/g) || [];
  return myers(split(a), split(b));
}

/**
 * Produce a JSON Patch (RFC 6902) style diff between two JSON values.
 * Uses structural comparison — arrays diff by element, objects by key.
 * Returns array of { op, path, value? }.
 * @param {*} a
 * @param {*} b
 * @param {string} [base='']
 * @returns {Array<{op:string, path:string, value?:*}>}
 */
function diffJson(a, b, base = '') {
  const patches = [];

  if (a === b) return patches;

  if (typeof a !== typeof b || a === null || b === null) {
    // Type change or null → replace
    patches.push({ op: 'replace', path: base || '/', value: b });
    return patches;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const ops = myers(a, b);
    let ai = 0; // index into original array `a`

    for (const op of ops) {
      if (op.type === 'equal') {
        // Recurse for nested diffs
        const nested = diffJson(a[ai], b[ai], `${base}/${ai}`);
        patches.push(...nested);
        ai++;
      } else if (op.type === 'insert') {
        patches.push({ op: 'add', path: `${base}/${ai}`, value: op.value });
        ai++; // insertion advances both pointers conceptually
      } else if (op.type === 'delete') {
        patches.push({ op: 'remove', path: `${base}/${ai}` });
        // don't advance ai for removal — but since we're generating from the
        // merged perspective, we need to track carefully. Actually for simplicity,
        // let's just note the removal without advancing.
      }
    }
    return patches;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const allKeys = new Set([...keysA, ...keysB]);

    for (const key of allKeys) {
      const path = base === '' ? `/${key}` : `${base}/${key}`;
      const hasA = key in a;
      const hasB = key in b;

      if (hasA && hasB) {
        patches.push(...diffJson(a[key], b[key], path));
      } else if (hasB) {
        patches.push({ op: 'add', path, value: b[key] });
      } else {
        patches.push({ op: 'remove', path });
      }
    }
    return patches;
  }

  // Primitive value change
  if (a !== b) {
    patches.push({ op: 'replace', path: base || '/', value: b });
  }

  return patches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified diff format
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate unified diff output from line-level diff ops.
 *
 * @param {string} a — original text
 * @param {string} b — modified text
 * @param {object} [opts]
 * @param {string} [opts.from='a'] — filename for the "from" header
 * @param {string} [opts.to='b'] — filename for the "to" header
 * @param {number} [opts.context=3] — lines of context
 * @returns {string} unified diff text
 */
function unifiedDiff(a, b, opts = {}) {
  const { from = 'a', to = 'b', context = 3 } = opts;
  const ops = diffLines(a, b);

  // Group into hunks of consecutive changes with surrounding context
  const hunks = [];
  let currentHunk = null;
  let lineA = 0;
  let lineB = 0;

  // First pass: collect line numbers for all ops
  const indexed = [];
  for (const op of ops) {
    indexed.push({ ...op, lineA, lineB });
    if (op.type === 'equal') {
      lineA++;
      lineB++;
    } else if (op.type === 'delete') {
      lineA++;
    } else if (op.type === 'insert') {
      lineB++;
    }
  }

  // Find change blocks and build hunks
  let i = 0;
  while (i < indexed.length) {
    if (indexed[i].type === 'equal') {
      i++;
      continue;
    }

    // Found a change — find the full block
    let start = Math.max(0, i - context);
    let end = i;

    // Extend forward to capture all connected changes + trailing context
    while (end < indexed.length) {
      if (indexed[end].type !== 'equal') {
        end++;
      } else {
        // Check if there's another change within context range
        let lookAhead = end;
        let contextCount = 0;
        while (lookAhead < indexed.length && indexed[lookAhead].type === 'equal' && contextCount < context) {
          lookAhead++;
          contextCount++;
        }
        if (lookAhead < indexed.length && indexed[lookAhead].type !== 'equal') {
          end = lookAhead;
        } else {
          break;
        }
      }
    }

    // Build the hunk
    const hunkStartA = indexed[start].lineA + 1;
    const hunkStartB = indexed[start].lineB + 1;

    let countA = 0;
    let countB = 0;
    const lines = [];

    for (let j = start; j < end; j++) {
      const op = indexed[j];
      if (op.type === 'equal') {
        lines.push(` ${op.value}`);
        countA++;
        countB++;
      } else if (op.type === 'delete') {
        lines.push(`-${op.value}`);
        countA++;
      } else if (op.type === 'insert') {
        lines.push(`+${op.value}`);
        countB++;
      }
    }

    hunks.push({
      startA: hunkStartA,
      startB: hunkStartB,
      countA,
      countB,
      lines,
    });

    i = end;
  }

  // Format output
  const header = [`--- ${from}`, `+++ ${to}`];
  const body = hunks.map((h) => {
    const range = (start, count) =>
      count === 0 ? `${start},0` : `${start},${count}`;
    return `@@ -${range(h.startA, h.countA)} +${range(h.startB, h.countB)} @@\n${h.lines.join('\n')}`;
  });

  return header.concat(body).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch generation & application
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a structured patch object from two texts (line-level).
 * @param {string} a
 * @param {string} b
 * @param {object} [opts]
 * @returns {{hunks: Array, from: string, to: string}}
 */
function createPatch(a, b, opts = {}) {
  const { from = 'a', to = 'b', context = 3 } = opts;
  const text = unifiedDiff(a, b, { from, to, context });
  return { from, to, raw: text };
}

/**
 * Apply unified diff text to original text.
 * Parses hunks and applies additions/removals.
 * @param {string} original
 * @param {string} patchText — unified diff
 * @returns {string} patched text
 */
function applyPatch(original, patchText) {
  const lines = original.split('\n');
  const patchLines = patchText.split('\n');

  // Parse hunks from patch text
  const hunks = [];
  let i = 0;
  while (i < patchLines.length) {
    const line = patchLines[i];
    const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (match) {
      const oldStart = parseInt(match[1], 10);
      const hunkLines = [];
      i++;
      while (i < patchLines.length && !patchLines[i].startsWith('@@') && patchLines[i] !== undefined) {
        // Stop at file headers
        if (patchLines[i].startsWith('--- ') || patchLines[i].startsWith('+++ ')) break;
        hunkLines.push(patchLines[i]);
        i++;
      }
      hunks.push({ oldStart, lines: hunkLines });
    } else {
      i++;
    }
  }

  // Apply hunks in reverse order to preserve line numbers
  hunks.reverse();

  const result = [...lines];
  for (const hunk of hunks) {
    let pos = hunk.oldStart - 1; // 1-based to 0-based
    if (pos < 0) pos = 0;

    for (const line of hunk.lines) {
      if (line.startsWith('-')) {
        // Delete line at pos
        result.splice(pos, 1);
      } else if (line.startsWith('+')) {
        // Insert line at pos
        result.splice(pos, 0, line.slice(1));
        pos++;
      } else {
        // Context line — just advance
        pos++;
      }
    }
  }

  return result.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats & formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute diff statistics from ops.
 * @param {Array<{type:string}>} ops
 * @returns {{additions:number, deletions:number, changes:number}}
 */
function diffStats(ops) {
  let additions = 0;
  let deletions = 0;
  for (const op of ops) {
    if (op.type === 'insert') additions++;
    else if (op.type === 'delete') deletions++;
  }
  return { additions, deletions, changes: additions + deletions };
}

/**
 * Format diff ops with ANSI colors for terminal output.
 * @param {Array<{type:string, value:*}>} ops
 * @returns {string}
 */
function formatColor(ops) {
  const GREEN = '\x1b[32m';
  const RED = '\x1b[31m';
  const RESET = '\x1b[0m';
  const DIM = '\x1b[2m';

  return ops
    .map((op) => {
      if (op.type === 'insert') return `${GREEN}+${op.value}${RESET}`;
      if (op.type === 'delete') return `${RED}-${op.value}${RESET}`;
      return `${DIM} ${op.value}${RESET}`;
    })
    .join('\n');
}

/**
 * Format diff ops as plain text (no colors).
 * @param {Array<{type:string, value:*}>} ops
 * @returns {string}
 */
function formatPlain(ops) {
  return ops
    .map((op) => {
      if (op.type === 'insert') return `+${op.value}`;
      if (op.type === 'delete') return `-${op.value}`;
      return ` ${op.value}`;
    })
    .join('\n');
}

/**
 * Format diff ops as HTML with spans.
 * @param {Array<{type:string, value:*}>} ops
 * @returns {string}
 */
function formatHtml(ops) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  return ops
    .map((op) => {
      if (op.type === 'insert') return `<ins>${esc(op.value)}</ins>`;
      if (op.type === 'delete') return `<del>${esc(op.value)}</del>`;
      return `<span>${esc(op.value)}</span>`;
    })
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// LCS (Longest Common Subsequence) — alternative to Myers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the longest common subsequence of two arrays.
 * Uses standard DP. Returns the LCS as an array.
 * @param {Array} a
 * @param {Array} b
 * @param {function} [eq]
 * @returns {Array}
 */
function lcs(a, b, eq = Object.is) {
  const n = a.length;
  const m = b.length;

  if (n === 0 || m === 0) return [];

  // DP table
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (eq(a[i - 1], b[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (eq(a[i - 1], b[j - 1])) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Core
  myers,
  lcs,

  // Diff functions
  diffArrays,
  diffLines,
  diffChars,
  diffWords,
  diffSentences,
  diffJson,

  // Unified diff
  unifiedDiff,
  createPatch,
  applyPatch,

  // Stats & formatting
  diffStats,
  formatColor,
  formatPlain,
  formatHtml,
};
