import { addMonths } from '@/lib/date';
import { startOfMonth } from '@/lib/stats';

import type { LoanStatus } from '@/db/schema';

type PaymentLike = {
  dueDate: Date;
  isPaid: boolean;
  paidAt: Date | null;
  amountCents: number;
  principalPortionCents: number;
  interestPortionCents: number;
};

type CategoryLike = {
  id: number;
  name: string;
  color: string | null;
};

type LoanLike = {
  principalCents: number;
  status: LoanStatus;
  payments: PaymentLike[];
  category?: CategoryLike | null;
};

export type BalancePoint = {
  month: Date;
  balanceCents: number;
  projected: boolean;
};

/**
 * Total outstanding balance across all loans, one point per month, from the
 * earliest scheduled installment through the latest. Months up to and including
 * the current one use actual paid history; months after project forward assuming
 * every remaining installment is paid on its scheduled due date.
 */
export function buildBalanceTimeline(loans: LoanLike[], now: Date = new Date()): BalancePoint[] {
  const allDueDates = loans.flatMap((loan) => loan.payments.map((payment) => payment.dueDate));
  if (allDueDates.length === 0) return [];

  const currentMonth = startOfMonth(now);
  const minMonth = startOfMonth(new Date(Math.min(...allDueDates.map((d) => d.getTime()), now.getTime())));
  const maxMonth = startOfMonth(new Date(Math.max(...allDueDates.map((d) => d.getTime()), now.getTime())));

  const points: BalancePoint[] = [];
  let cursor = minMonth;

  while (cursor.getTime() <= maxMonth.getTime()) {
    const monthEnd = addMonths(cursor, 1);
    const projected = cursor.getTime() > currentMonth.getTime();

    const balanceCents = loans.reduce((sum, loan) => {
      const settledPrincipal = loan.payments.reduce((paidSum, payment) => {
        const isSettled = projected
          ? payment.dueDate.getTime() < monthEnd.getTime()
          : payment.isPaid && !!payment.paidAt && payment.paidAt.getTime() < monthEnd.getTime();
        return isSettled ? paidSum + payment.principalPortionCents : paidSum;
      }, 0);
      return sum + Math.max(loan.principalCents - settledPrincipal, 0);
    }, 0);

    points.push({ month: cursor, balanceCents, projected });
    cursor = addMonths(cursor, 1);
  }

  return points;
}

/** The latest due date among unpaid installments of loans that aren't fully paid off, or null if debt-free. */
export function projectedDebtFreeDate(loans: LoanLike[]): Date | null {
  const unpaidDueDates = loans
    .filter((loan) => loan.status !== 'paid_off')
    .flatMap((loan) => loan.payments.filter((payment) => !payment.isPaid).map((payment) => payment.dueDate));

  if (unpaidDueDates.length === 0) return null;
  return new Date(Math.max(...unpaidDueDates.map((date) => date.getTime())));
}

export function interestSplit(allPayments: Pick<PaymentLike, 'isPaid' | 'interestPortionCents'>[]) {
  return allPayments.reduce(
    (acc, payment) => {
      if (payment.isPaid) acc.paidCents += payment.interestPortionCents;
      else acc.remainingCents += payment.interestPortionCents;
      return acc;
    },
    { paidCents: 0, remainingCents: 0 }
  );
}

export type CategorySlice = {
  key: string;
  name: string;
  color: string | null;
  paidCents: number;
  owedCents: number;
};

/** Paid vs. still-owed totals grouped by loan category, sorted by total volume descending. */
export function categoryBreakdown(loans: LoanLike[]): CategorySlice[] {
  const slices = new Map<string, CategorySlice>();

  for (const loan of loans) {
    const key = loan.category ? String(loan.category.id) : 'uncategorized';
    if (!slices.has(key)) {
      slices.set(key, {
        key,
        name: loan.category?.name ?? 'Uncategorized',
        color: loan.category?.color ?? null,
        paidCents: 0,
        owedCents: 0,
      });
    }

    const slice = slices.get(key)!;
    for (const payment of loan.payments) {
      if (payment.isPaid) slice.paidCents += payment.amountCents;
      else slice.owedCents += payment.amountCents;
    }
  }

  return Array.from(slices.values()).sort(
    (a, b) => b.paidCents + b.owedCents - (a.paidCents + a.owedCents)
  );
}
