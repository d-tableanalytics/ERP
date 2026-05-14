/**
 * Tiny markdown helpers. Frontend renders markdown natively; backend uses
 * these to keep its emitted text consistent.
 */

function bullet(items = []) {
  return items.map((s) => `• ${s}`).join('\n');
}

function bold(s) { return `**${s}**`; }

function fieldLine(label, value) {
  if (value == null || value === '') return null;
  return `• **${label}:** ${value}`;
}

function detailBlock(title, fields) {
  const lines = [bold(title)];
  for (const [label, value] of fields) {
    const l = fieldLine(label, value);
    if (l) lines.push(l);
  }
  return lines.join('\n');
}

module.exports = { bullet, bold, fieldLine, detailBlock };
