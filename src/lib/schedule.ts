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
  isPaid: boolean;
  paidAt: Date | null;
};

export type ScheduleEntry<P> = {
  index: number;
  dueDate: Date;
  amountCents: number;
  paid: boolean;
  /** Only meaningful when paid: whether it was settled on or before its due date. */
  onTime: boolean;
  daysLate: number;
  payment: P;
};

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
