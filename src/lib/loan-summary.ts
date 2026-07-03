type LoanSummaryTransaction = {
  amountCents: number;
  principalAppliedCents: number;
};

type LoanSummaryPayment = {
  installmentNumber: number;
  amountCents: number;
  paidCents: number;
  isPaid: boolean;
};

type LoanSummaryInput = {
  principalCents: number;
  monthlyPaymentCents: number;
  termMonths: number;
  payments: LoanSummaryPayment[];
  transactions: LoanSummaryTransaction[];
};

export function buildLoanSummary({
  principalCents,
  monthlyPaymentCents,
  termMonths,
  payments,
  transactions,
}: LoanSummaryInput) {
  const totalContractCents = monthlyPaymentCents * termMonths;
  const totalInterestCents = Math.max(totalContractCents - principalCents, 0);
  const totalPaidCents = transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0);
  const principalPaidCents = transactions.reduce(
    (sum, transaction) => sum + transaction.principalAppliedCents,
    0
  );
  const currentInstallment = [...payments]
    .sort((a, b) => a.installmentNumber - b.installmentNumber)
    .find((payment) => !payment.isPaid);
  const remainingPrincipalCents = Math.max(principalCents - principalPaidCents, 0);
  const principalProgress =
    principalCents > 0 ? Math.min(principalPaidCents / principalCents, 1) : 0;
  const currentInstallmentRemainingCents = currentInstallment
    ? Math.max(currentInstallment.amountCents - currentInstallment.paidCents, 0)
    : 0;
  const currentInstallmentPaidCents = currentInstallment?.paidCents ?? 0;
  const totalRemainingCents = payments.reduce(
    (sum, payment) => sum + Math.max(payment.amountCents - payment.paidCents, 0),
    0
  );

  return {
    currentInstallmentPaidCents,
    currentInstallmentRemainingCents,
    totalContractCents,
    totalInterestCents,
    totalPaidCents,
    totalRemainingCents,
    totalRemainingPrincipalCents: remainingPrincipalCents,
    principalPaidCents,
    remainingPrincipalCents,
    principalProgress,
  };
}
