import { addMonths } from '@/lib/date';

type LoanLike = {
  principalCents: number;
  monthlyPaymentCents: number;
  termMonths: number;
  startDate: Date;
  firstPaymentDate: Date | null;
};

/** The recurring schedule's anchor date — falls back to startDate for loans created before this field existed. */
export function scheduleAnchor(loan: Pick<LoanLike, 'startDate' | 'firstPaymentDate'>) {
  return loan.firstPaymentDate ?? loan.startDate;
}

export type InstallmentDraft = {
  installmentNumber: number;
  dueDate: Date;
  amountCents: number;
  principalPortionCents: number;
  interestPortionCents: number;
};

/** Builds the full month-by-month installment schedule for a loan, ready to insert into `payments`. */
export function buildInstallmentSchedule(loan: LoanLike): InstallmentDraft[] {
  const anchor = scheduleAnchor(loan);
  const principalPortionCents = Math.round(loan.principalCents / loan.termMonths);
  const interestPortionCents = loan.monthlyPaymentCents - principalPortionCents;

  return Array.from({ length: loan.termMonths }, (_, index) => ({
    installmentNumber: index + 1,
    dueDate: addMonths(anchor, index),
    amountCents: loan.monthlyPaymentCents,
    principalPortionCents,
    interestPortionCents,
  }));
}

type PaymentLike = {
  installmentNumber: number;
  dueDate: Date;
  amountCents: number;
  paidCents: number;
  isPaid: boolean;
  paidAt: Date | null;
};

export type ScheduleEntry<P> = {
  index: number;
  dueDate: Date;
  amountCents: number;
  paid: boolean;
  paidCents: number;
  remainingCents: number;
  /** Some money applied but not settled. */
  partial: boolean;
  /** Only meaningful when paid: whether it was settled on or before its due date. */
  onTime: boolean;
  daysLate: number;
  payment: P;
};

/** What's still owed on a single installment row. */
export function remainingDueCents(row: { amountCents: number; paidCents: number }): number {
  return Math.max(row.amountCents - row.paidCents, 0);
}

export type PaymentAllocation = {
  interestAppliedCents: number;
  principalAppliedCents: number;
  /** Amount beyond the row's remaining due — becomes extra principal. */
  overflowCents: number;
};

/** Splits a payment against one installment, interest-first: the row's interest portion is covered
 * before principal, accounting for what earlier partial payments already covered. */
export function allocatePaymentToInstallment(
  row: { amountCents: number; paidCents: number; interestPortionCents: number },
  amountCents: number
): PaymentAllocation {
  const remaining = remainingDueCents(row);
  const applied = Math.min(Math.max(amountCents, 0), remaining);
  const interestAlreadyCovered = Math.min(row.paidCents, row.interestPortionCents);
  const interestAppliedCents = Math.min(applied, row.interestPortionCents - interestAlreadyCovered);

  return {
    interestAppliedCents,
    principalAppliedCents: applied - interestAppliedCents,
    overflowCents: Math.max(amountCents - remaining, 0),
  };
}

export type PaymentRowLike = {
  installmentNumber: number;
  amountCents: number;
  principalPortionCents: number;
  interestPortionCents: number;
  paidCents: number;
};

/** Principal a row's paidCents has covered so far, under interest-first allocation. */
export function principalCoveredCents(
  row: Pick<PaymentRowLike, 'paidCents' | 'interestPortionCents'>
): number {
  return Math.max(row.paidCents - row.interestPortionCents, 0);
}

/**
 * Regenerates the fully-unpaid tail of a loan's schedule under the fixed-payment /
 * shrinking-tail policy: extra principal never changes the monthly amount, it removes
 * months from the end. Locked rows (paidCents > 0 — paid or partial) are never touched;
 * they keep collecting their own remaining dues.
 *
 * The tail's principal is `principal − Σ locked principal portions − extra principal`.
 * The last draft absorbs any rounding remainder so `Σ principalPortionCents === principalCents`
 * across locked rows + drafts, and the tail never extends past the original termMonths.
 */
export function rebuildUnpaidInstallments(
  loan: LoanLike,
  lockedRows: Pick<PaymentRowLike, 'installmentNumber' | 'principalPortionCents'>[],
  extraPrincipalCents: number
): InstallmentDraft[] {
  const anchor = scheduleAnchor(loan);
  const basePortionCents = Math.round(loan.principalCents / loan.termMonths);
  const interestPortionCents = loan.monthlyPaymentCents - basePortionCents;

  const lockedPrincipal = lockedRows.reduce((sum, row) => sum + row.principalPortionCents, 0);
  const remainingPrincipal = Math.max(
    loan.principalCents - lockedPrincipal - Math.max(extraPrincipalCents, 0),
    0
  );
  if (remainingPrincipal === 0 || basePortionCents <= 0) return [];

  const maxTail = Math.max(loan.termMonths - lockedRows.length, 1);
  const count = Math.min(Math.ceil(remainingPrincipal / basePortionCents), maxTail);

  const usedNumbers = new Set(lockedRows.map((row) => row.installmentNumber));
  const freeNumbers: number[] = [];
  for (let candidate = 1; freeNumbers.length < count; candidate += 1) {
    if (!usedNumbers.has(candidate)) freeNumbers.push(candidate);
  }

  return freeNumbers.map((installmentNumber, index) => {
    const isLast = index === count - 1;
    const principalPortion = isLast
      ? remainingPrincipal - basePortionCents * (count - 1)
      : basePortionCents;

    return {
      installmentNumber,
      dueDate: addMonths(anchor, installmentNumber - 1),
      amountCents: principalPortion + interestPortionCents,
      principalPortionCents: principalPortion,
      interestPortionCents,
    };
  });
}

/** Principal still schedulable in the unpaid tail — the most an extra payment can absorb.
 * Rows with money applied are excluded: they stay due for their own remainders. */
export function extraPaymentCapacityCents(
  loan: Pick<LoanLike, 'principalCents'>,
  rows: Pick<PaymentRowLike, 'principalPortionCents' | 'paidCents'>[],
  extraPrincipalCents: number
): number {
  const lockedPrincipal = rows.reduce(
    (sum, row) => (row.paidCents > 0 ? sum + row.principalPortionCents : sum),
    0
  );
  return Math.max(loan.principalCents - lockedPrincipal - Math.max(extraPrincipalCents, 0), 0);
}

/**
 * Total cash needed to fully settle the loan today: the remaining due on every row that has
 * money applied (their interest is owed either way) plus the raw principal of the unpaid tail —
 * paying off early skips the tail's future interest entirely.
 */
export function remainingPayoffCents(
  loan: Pick<LoanLike, 'principalCents'>,
  rows: PaymentRowLike[],
  extraPrincipalCents: number
): number {
  const lockedRemaining = rows.reduce(
    (sum, row) => (row.paidCents > 0 ? sum + remainingDueCents(row) : sum),
    0
  );
  return lockedRemaining + extraPaymentCapacityCents(loan, rows, extraPrincipalCents);
}

/** Orders a loan's installment rows for display. Each row already carries its own paid state,
 * so any installment can be marked paid independently of the others. */
export function getScheduleForLoan<P extends PaymentLike>(paymentRows: P[]): ScheduleEntry<P>[] {
  return [...paymentRows]
    .sort((a, b) => a.installmentNumber - b.installmentNumber)
    .map((payment) => {
      const daysLate =
        payment.isPaid && payment.paidAt
          ? Math.max(0, Math.round((payment.paidAt.getTime() - payment.dueDate.getTime()) / 86_400_000))
          : 0;

      return {
        index: payment.installmentNumber - 1,
        dueDate: payment.dueDate,
        amountCents: payment.amountCents,
        paid: payment.isPaid,
        paidCents: payment.paidCents,
        remainingCents: remainingDueCents(payment),
        partial: payment.paidCents > 0 && !payment.isPaid,
        onTime: daysLate === 0,
        daysLate,
        payment,
      };
    });
}

/** Earliest unpaid installment's due date, or the last installment's due date once everything is paid. */
export function computeNextDueDate(
  paymentRows: { installmentNumber: number; dueDate: Date; isPaid: boolean }[]
): Date {
  const sorted = [...paymentRows].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const nextUnpaid = sorted.find((payment) => !payment.isPaid);
  return (nextUnpaid ?? sorted[sorted.length - 1]).dueDate;
}
