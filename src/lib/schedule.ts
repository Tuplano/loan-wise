import { addMonths } from '@/lib/date';

type PaymentLike = {
  paidAt: Date;
  amountCents: number;
};

type LoanLike = {
  startDate: Date;
  termMonths: number;
  monthlyPaymentCents: number;
};

export type ScheduleEntry = {
  index: number;
  dueDate: Date;
  scheduledDate: Date;
  amountCents: number;
  paid: boolean;
  /** Only meaningful when paid: whether it was settled on or before its scheduled month. */
  onTime: boolean;
  daysLate: number;
};

/** Builds the month-by-month schedule for a loan, matching payments to installments in order. */
export function getScheduleForLoan<P extends PaymentLike>(
  loan: LoanLike,
  paymentsAscending: P[]
): (ScheduleEntry & { payment: P | null })[] {
  return Array.from({ length: loan.termMonths }, (_, index) => {
    const payment = paymentsAscending[index] ?? null;
    const scheduledDate = addMonths(loan.startDate, index);
    const dueDate = payment ? payment.paidAt : scheduledDate;
    const daysLate = payment
      ? Math.max(0, Math.round((payment.paidAt.getTime() - scheduledDate.getTime()) / 86_400_000))
      : 0;

    return {
      index,
      dueDate,
      scheduledDate,
      amountCents: payment ? payment.amountCents : loan.monthlyPaymentCents,
      paid: Boolean(payment),
      onTime: daysLate === 0,
      daysLate,
      payment,
    };
  });
}
