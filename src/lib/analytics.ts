import { addMonths } from '@/lib/date';
import { principalCoveredCents, remainingDueCents } from '@/lib/schedule';
import { startOfMonth } from '@/lib/stats';

import type { LoanStatus } from '@/db/schema';

type PaymentLike = {
  dueDate: Date;
  isPaid: boolean;
  paidAt: Date | null;
  amountCents: number;
  paidCents: number;
  principalPortionCents: number;
  interestPortionCents: number;
};

type TransactionLike = {
  paidAt: Date;
  amountCents: number;
  principalAppliedCents: number;
  interestAppliedCents: number;
};

type CategoryLike = {
  id: number;
  name: string;
  color: string | null;
};

type LoanLike = {
  id: number;
  name: string;
  principalCents: number;
  status: LoanStatus;
  payments: PaymentLike[];
  transactions: TransactionLike[];
  category?: CategoryLike | null;
};

export type BalancePoint = {
  month: Date;
  balanceCents: number;
  projected: boolean;
};

/** Every month from the earliest scheduled installment through the latest, across all given loans. */
function monthRange(loans: LoanLike[], now: Date): Date[] {
  const allDueDates = loans.flatMap((loan) => loan.payments.map((payment) => payment.dueDate));
  if (allDueDates.length === 0) return [];

  const minMonth = startOfMonth(new Date(Math.min(...allDueDates.map((d) => d.getTime()), now.getTime())));
  const maxMonth = startOfMonth(new Date(Math.max(...allDueDates.map((d) => d.getTime()), now.getTime())));

  const months: Date[] = [];
  let cursor = minMonth;
  while (cursor.getTime() <= maxMonth.getTime()) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

/** A single loan's outstanding balance as of the end of `monthStart`'s month. Actual history is used
 * up to the current month; later months project forward assuming on-schedule payment. */
function balanceAtMonth(loan: LoanLike, monthStart: Date, currentMonth: Date): number {
  const monthEnd = addMonths(monthStart, 1);
  const projected = monthStart.getTime() > currentMonth.getTime();

  // Principal actually applied so far (installments, partials, and extras) as of monthEnd.
  const actualPrincipal = loan.transactions.reduce(
    (sum, transaction) =>
      transaction.paidAt.getTime() < monthEnd.getTime() ? sum + transaction.principalAppliedCents : sum,
    0
  );

  if (!projected) return Math.max(loan.principalCents - actualPrincipal, 0);

  // Projected months: everything paid to date, plus each row's not-yet-covered principal
  // once its due date passes. Fully-paid rows contribute 0 here (their principal is in
  // the transactions already), so no double counting.
  const scheduledPrincipal = loan.payments.reduce((sum, payment) => {
    if (payment.dueDate.getTime() >= monthEnd.getTime()) return sum;
    return sum + (payment.principalPortionCents - principalCoveredCents(payment));
  }, 0);

  return Math.max(loan.principalCents - actualPrincipal - scheduledPrincipal, 0);
}

/**
 * Total outstanding balance across all loans, one point per month, from the
 * earliest scheduled installment through the latest. Months up to and including
 * the current one use actual paid history; months after project forward assuming
 * every remaining installment is paid on its scheduled due date.
 */
export function buildBalanceTimeline(loans: LoanLike[], now: Date = new Date()): BalancePoint[] {
  const currentMonth = startOfMonth(now);
  return monthRange(loans, now).map((month) => ({
    month,
    balanceCents: loans.reduce((sum, loan) => sum + balanceAtMonth(loan, month, currentMonth), 0),
    projected: month.getTime() > currentMonth.getTime(),
  }));
}

export type LoanBalanceLine = {
  loanId: number;
  name: string;
  color: string | null;
  points: BalancePoint[];
  /** The loan's final scheduled installment date — its real end date, independent of any rounding
   * in the balance curve above (which can asymptote to a few cents rather than exactly zero). */
  endDate: Date;
};

/**
 * One balance line per loan, all sharing the same month range so they can be overlaid on a single
 * chart — each line flattens to zero once that loan is (or is projected to be) fully paid off, making
 * it visually obvious when each individual loan ends relative to the others.
 */
export function buildPerLoanBalanceTimelines(loans: LoanLike[], now: Date = new Date()): LoanBalanceLine[] {
  const months = monthRange(loans, now);
  const currentMonth = startOfMonth(now);

  return loans.map((loan) => {
    const dueDates = loan.payments.map((payment) => payment.dueDate.getTime());
    const endDate = dueDates.length > 0 ? new Date(Math.max(...dueDates)) : now;

    return {
      loanId: loan.id,
      name: loan.name,
      color: loan.category?.color ?? null,
      endDate,
      points: months.map((month) => ({
        month,
        balanceCents: balanceAtMonth(loan, month, currentMonth),
        projected: month.getTime() > currentMonth.getTime(),
      })),
    };
  });
}

/** The latest due date among unpaid installments of loans that aren't fully paid off, or null if debt-free. */
export function projectedDebtFreeDate(loans: LoanLike[]): Date | null {
  const unpaidDueDates = loans
    .filter((loan) => loan.status !== 'paid_off')
    .flatMap((loan) => loan.payments.filter((payment) => !payment.isPaid).map((payment) => payment.dueDate));

  if (unpaidDueDates.length === 0) return null;
  return new Date(Math.max(...unpaidDueDates.map((date) => date.getTime())));
}

export function interestSplit(
  allPayments: Pick<PaymentLike, 'isPaid' | 'paidCents' | 'interestPortionCents'>[],
  allTransactions: Pick<TransactionLike, 'interestAppliedCents'>[]
) {
  const paidCents = allTransactions.reduce((sum, tx) => sum + tx.interestAppliedCents, 0);
  // Interest-first allocation: a row's paidCents covers its interest portion before principal.
  const remainingCents = allPayments.reduce(
    (sum, payment) =>
      payment.isPaid
        ? sum
        : sum + payment.interestPortionCents - Math.min(payment.paidCents, payment.interestPortionCents),
    0
  );
  return { paidCents, remainingCents };
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
    for (const transaction of loan.transactions) {
      slice.paidCents += transaction.amountCents;
    }
    for (const payment of loan.payments) {
      slice.owedCents += remainingDueCents(payment);
    }
  }

  return Array.from(slices.values()).sort(
    (a, b) => b.paidCents + b.owedCents - (a.paidCents + a.owedCents)
  );
}
