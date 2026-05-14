/**
 * Tiny schema validator (no external deps). Each schema is a plain object:
 *   { fieldName: { type, required?, enum?, max?, min? } }
 * Returns { ok: true, value } or { ok: false, errors: string[] }.
 * Used to defend tool handlers from malformed LLM-generated args.
 */

function checkValue(name, value, rule) {
  const errors = [];
  if (value == null || value === '') {
    if (rule.required) errors.push(`${name} is required`);
    return errors;
  }
  if (rule.type === 'string') {
    if (typeof value !== 'string') errors.push(`${name} must be a string`);
    else if (rule.max && value.length > rule.max) errors.push(`${name} must be ≤ ${rule.max} chars`);
  } else if (rule.type === 'number' || rule.type === 'integer') {
    const n = Number(value);
    if (!Number.isFinite(n)) errors.push(`${name} must be a number`);
    else {
      if (rule.type === 'integer' && !Number.isInteger(n)) errors.push(`${name} must be integer`);
      if (rule.min != null && n < rule.min) errors.push(`${name} must be ≥ ${rule.min}`);
      if (rule.max != null && n > rule.max) errors.push(`${name} must be ≤ ${rule.max}`);
    }
  } else if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${name} must be boolean`);
  } else if (rule.type === 'date') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) errors.push(`${name} must be a valid date`);
  }
  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`${name} must be one of: ${rule.enum.join(', ')}`);
  }
  return errors;
}

function coerce(value, rule) {
  if (value == null) return value;
  if (rule.type === 'integer') return parseInt(value, 10);
  if (rule.type === 'number') return Number(value);
  if (rule.type === 'string') return String(value).trim();
  return value;
}

function validate(args, schema) {
  const result = {};
  const errors = [];
  for (const [name, rule] of Object.entries(schema)) {
    const v = args ? args[name] : undefined;
    const fieldErrors = checkValue(name, v, rule);
    if (fieldErrors.length) {
      errors.push(...fieldErrors);
      continue;
    }
    if (v != null && v !== '') result[name] = coerce(v, rule);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: result };
}

module.exports = { validate };
