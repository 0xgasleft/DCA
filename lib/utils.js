export function formatNumber(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';

  if (num === Math.floor(num)) {
    return num.toString();
  }

  return num.toString().replace(/\.?0+$/, '');
}
