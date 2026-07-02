export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ordinalSuffix(day: number) {
  if (day % 10 === 1 && day !== 11) return 'st';
  if (day % 10 === 2 && day !== 12) return 'nd';
  if (day % 10 === 3 && day !== 13) return 'rd';
  return 'th';
}
