export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function sumPaymentsInMonth<T extends { paidAt: Date; amountCents: number }>(
  payments: T[],
  month: Date = new Date()
) {
  return payments.reduce(
    (sum, payment) => (isSameMonth(payment.paidAt, month) ? sum + payment.amountCents : sum),
    0
  );
}

export function monthLabel(date: Date) {
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}
