type DashboardLoanLike = {
  monthlyPaymentCents: number;
  termMonths: number;
  transactions: { amountCents: number }[];
};

export function buildDashboardBalanceSummary(loans: DashboardLoanLike[]) {
  const totalBalanceCents = loans.reduce(
    (sum, loan) => sum + loan.monthlyPaymentCents * loan.termMonths,
    0
  );
  const paidBalanceCents = loans.reduce(
    (sum, loan) =>
      sum + loan.transactions.reduce((loanSum, transaction) => loanSum + transaction.amountCents, 0),
    0
  );

  return {
    totalBalanceCents,
    paidBalanceCents,
    outstandingBalanceCents: Math.max(totalBalanceCents - paidBalanceCents, 0),
  };
}
