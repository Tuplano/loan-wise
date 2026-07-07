import { addMonths } from '@/lib/date';
import { startOfMonth } from '@/lib/loans/stats';

export type PayoffStrategy = 'snowball' | 'avalanche';

type PlannerPaymentLike = {
  dueDate: Date;
  isPaid: boolean;
  amountCents: number;
  paidCents: number;
  principalPortionCents: number;
  interestPortionCents: number;
};

export type PlannerLoanLike = {
  id: number;
  name: string;
  interestRate: number;
  monthlyPaymentCents: number;
  payments: PlannerPaymentLike[];
};

export type LoanPayoff = {
  loanId: number;
  name: string;
  payoffMonth: Date;
};

export type PayoffPlan = {
  strategy: PayoffStrategy | 'baseline';
  extraMonthlyCents: number;
  /** Null when there is no open debt to simulate. */
  debtFreeMonth: Date | null;
  /** Months from now until debt-free. */
  months: number;
  /** Interest still to be paid from now until debt-free under this plan. */
  interestPaidCents: number;
  interestSavedCents: number;
  monthsSaved: number;
  loanPayoffs: LoanPayoff[];
  /** Total outstanding principal at each month boundary, starting with today's balance. */
  balancePoints: { month: Date; balanceCents: number }[];
};

type SimInstallment = {
  dueMonthIndex: number;
  principalLeftCents: number;
  interestLeftCents: number;
  /** Only fully-untouched installments can be removed by extra principal — partially-paid
   * months keep their full remainder due, mirroring extraPaymentCapacityCents. */
  extraEligible: boolean;
};

type SimLoan = {
  id: number;
  name: string;
  interestRate: number;
  monthlyPaymentCents: number;
  queue: SimInstallment[];
  payoffMonthIndex: number | null;
};

function monthIndexOf(date: Date, startMonth: Date): number {
  return (
    (date.getFullYear() - startMonth.getFullYear()) * 12 + (date.getMonth() - startMonth.getMonth())
  );
}

function buildSimLoans(loans: PlannerLoanLike[], startMonth: Date): SimLoan[] {
  return loans
    .map((loan) => {
      const queue = [...loan.payments]
        .filter((payment) => !payment.isPaid)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
        .map((payment) => {
          // Interest-first allocation: paidCents covers the interest portion before principal.
          const interestCovered = Math.min(payment.paidCents, payment.interestPortionCents);
          return {
            dueMonthIndex: Math.max(monthIndexOf(startOfMonth(payment.dueDate), startMonth), 0),
            principalLeftCents:
              payment.principalPortionCents - Math.max(payment.paidCents - payment.interestPortionCents, 0),
            interestLeftCents: payment.interestPortionCents - interestCovered,
            extraEligible: payment.paidCents === 0,
          };
        });
      return {
        id: loan.id,
        name: loan.name,
        interestRate: loan.interestRate,
        monthlyPaymentCents: loan.monthlyPaymentCents,
        queue,
        payoffMonthIndex: null as number | null,
      };
    })
    .filter((loan) => loan.queue.length > 0);
}

function outstandingCents(loan: SimLoan): number {
  return loan.queue.reduce(
    (sum, installment) => sum + installment.principalLeftCents + installment.interestLeftCents,
    0
  );
}

function pickTarget(loans: SimLoan[], strategy: PayoffStrategy): SimLoan | null {
  const open = loans.filter(
    (loan) => loan.queue.some((installment) => installment.extraEligible)
  );
  if (open.length === 0) return null;

  return open.reduce((best, loan) => {
    if (strategy === 'avalanche') {
      if (loan.interestRate !== best.interestRate) {
        return loan.interestRate > best.interestRate ? loan : best;
      }
    }
    return outstandingCents(loan) < outstandingCents(best) ? loan : best;
  });
}

const MAX_MONTHS = 1200;

/**
 * Month-by-month what-if simulation. Every month the scheduled installments due get paid,
 * then (with a strategy) the extra budget — plus the freed-up payments of already-finished
 * loans — goes to the target loan as extra principal, removing months from the end of its
 * schedule. A removed month's interest is never paid: that's the saving. Pure and DB-free.
 */
export function simulatePayoff(
  loans: PlannerLoanLike[],
  options: { extraMonthlyCents: number; strategy: PayoffStrategy | null; now?: Date }
): PayoffPlan {
  const now = options.now ?? new Date();
  const startMonth = startOfMonth(now);
  const simLoans = buildSimLoans(loans, startMonth);

  const balancePoints = [
    {
      month: startMonth,
      balanceCents: simLoans.reduce(
        (sum, loan) => sum + loan.queue.reduce((s, i) => s + i.principalLeftCents, 0),
        0
      ),
    },
  ];

  let interestPaidCents = 0;
  let rolloverCents = 0;
  let month = 0;

  while (simLoans.some((loan) => loan.queue.length > 0) && month < MAX_MONTHS) {
    // Scheduled installments due this month (or overdue) get paid in full.
    for (const loan of simLoans) {
      while (loan.queue.length > 0 && loan.queue[0].dueMonthIndex <= month) {
        const installment = loan.queue.shift()!;
        interestPaidCents += installment.interestLeftCents;
      }
    }

    // Extra budget goes to the strategy's target as principal, removing the last
    // extra-eligible installment(s) — partially-paid months are never touched.
    if (options.strategy) {
      let budgetCents = options.extraMonthlyCents + rolloverCents;
      while (budgetCents > 0) {
        const target = pickTarget(simLoans, options.strategy);
        if (!target) break;
        let lastIndex = target.queue.length - 1;
        while (lastIndex >= 0 && !target.queue[lastIndex].extraEligible) lastIndex -= 1;
        const last = target.queue[lastIndex];
        const applied = Math.min(budgetCents, last.principalLeftCents);
        last.principalLeftCents -= applied;
        budgetCents -= applied;
        if (last.principalLeftCents === 0) target.queue.splice(lastIndex, 1);
        else break;
      }
    }

    for (const loan of simLoans) {
      if (loan.queue.length === 0 && loan.payoffMonthIndex === null) {
        loan.payoffMonthIndex = month;
        rolloverCents += loan.monthlyPaymentCents;
      }
    }

    month += 1;
    balancePoints.push({
      month: addMonths(startMonth, month),
      balanceCents: simLoans.reduce(
        (sum, loan) => sum + loan.queue.reduce((s, i) => s + i.principalLeftCents, 0),
        0
      ),
    });
  }

  const loanPayoffs = simLoans
    .filter((loan) => loan.payoffMonthIndex !== null)
    .sort((a, b) => a.payoffMonthIndex! - b.payoffMonthIndex!)
    .map((loan) => ({
      loanId: loan.id,
      name: loan.name,
      payoffMonth: addMonths(startMonth, loan.payoffMonthIndex!),
    }));

  return {
    strategy: options.strategy ?? 'baseline',
    extraMonthlyCents: options.extraMonthlyCents,
    debtFreeMonth: simLoans.length > 0 ? addMonths(startMonth, Math.max(month - 1, 0)) : null,
    months: simLoans.length > 0 ? month : 0,
    interestPaidCents,
    interestSavedCents: 0,
    monthsSaved: 0,
    loanPayoffs,
    balancePoints,
  };
}

export type PayoffComparison = {
  baseline: PayoffPlan;
  snowball: PayoffPlan;
  avalanche: PayoffPlan;
};

/** Runs all three plans over the same loans and fills in the savings vs the baseline. */
export function comparePayoffStrategies(
  loans: PlannerLoanLike[],
  extraMonthlyCents: number,
  now: Date = new Date()
): PayoffComparison {
  const baseline = simulatePayoff(loans, { extraMonthlyCents: 0, strategy: null, now });

  const withSavings = (plan: PayoffPlan): PayoffPlan => ({
    ...plan,
    interestSavedCents: Math.max(baseline.interestPaidCents - plan.interestPaidCents, 0),
    monthsSaved: Math.max(baseline.months - plan.months, 0),
  });

  return {
    baseline,
    snowball: withSavings(simulatePayoff(loans, { extraMonthlyCents, strategy: 'snowball', now })),
    avalanche: withSavings(simulatePayoff(loans, { extraMonthlyCents, strategy: 'avalanche', now })),
  };
}
