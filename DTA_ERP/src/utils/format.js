export function formatCurrency(value, currency = 'USD') {
  if (typeof value !== 'number') return value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}
