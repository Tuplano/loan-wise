export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function sumPaymentsInMonth<T extends { isPaid: boolean; paidAt: Date | null; amountCents: number }>(
  payments: T[],
  month: Date = new Date()
) {
  return payments.reduce(
    (sum, payment) =>
      payment.isPaid && payment.paidAt && isSameMonth(payment.paidAt, month)
        ? sum + payment.amountCents
        : sum,
    0
  );
}

/** Money actually paid in `month`, summed from transactions — unlike sumPaymentsInMonth,
 * this counts partial payments and extras in the month they happened. */
export function sumTransactionsInMonth<T extends { paidAt: Date; amountCents: number }>(
  transactions: T[],
  month: Date = new Date()
) {
  return transactions.reduce(
    (sum, transaction) => (isSameMonth(transaction.paidAt, month) ? sum + transaction.amountCents : sum),
    0
  );
}

export function monthLabel(date: Date) {
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
}
