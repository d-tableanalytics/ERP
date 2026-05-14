/**
 * Lightweight fuzzy-match helpers used to resolve user-provided names
 * ("website redesign" → matches "Website Redesign — Phase 2").
 */

function levenshtein(a = '', b = '') {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0).map((_, i) => i);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) v0[j] = v1[j];
  }
  return v1[b.length];
}

/**
 * Score 0..1 — higher is better. Considers exact substring, prefix, and edit distance.
 */
function similarity(query, candidate) {
  if (!query || !candidate) return 0;
  const q = String(query).trim().toLowerCase();
  const c = String(candidate).trim().toLowerCase();
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (c.includes(q)) return 0.85 + Math.min(0.1, q.length / Math.max(1, c.length) * 0.1);
  if (q.includes(c)) return 0.75;
  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Pick the best match from a list of candidates against a query.
 * Returns { item, score } or null if nothing scored above threshold.
 */
function bestMatch(query, candidates, getter = (x) => x, threshold = 0.55) {
  if (!query || !Array.isArray(candidates) || candidates.length === 0) return null;
  let best = null;
  for (const item of candidates) {
    const value = getter(item);
    const score = similarity(query, value);
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= threshold ? best : null;
}

module.exports = { levenshtein, similarity, bestMatch };
