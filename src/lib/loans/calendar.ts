import { isSameDay } from '@/lib/date';
import { startOfMonth } from '@/lib/loans/stats';

import type { TransactionKind } from '@/db/schema';

export type CalendarDueEntry = {
  loanId: number;
  loanName: string;
  amountCents: number;
  isPaid: boolean;
};

export type CalendarPaidEntry = {
  loanId: number;
  loanName: string;
  amountCents: number;
  kind: TransactionKind;
};

export type CalendarDay = {
  date: Date;
  inCurrentMonth: boolean;
  dueEntries: CalendarDueEntry[];
  paidEntries: CalendarPaidEntry[];
};

type CalendarLoan = {
  id: number;
  name: string;
  payments: { dueDate: Date; amountCents: number; isPaid: boolean }[];
  transactions: { paidAt: Date; amountCents: number; kind: TransactionKind }[];
};

/** YYYY-MM-DD in local time — the date-string format react-native-calendars keys `markedDates` by. */
export function toCalendarDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Builds a fixed 6-week (42 day) grid for the month containing `month`, starting on Sunday,
 * so every visible cell (including the leading/trailing days from adjacent months) has due
 * and paid entries attached. */
export function buildCalendarMonth(month: Date, loans: CalendarLoan[]): CalendarDay[] {
  const firstOfMonth = startOfMonth(month);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const dueEntries = loans.flatMap((loan) =>
      loan.payments
        .filter((payment) => isSameDay(payment.dueDate, date))
        .map((payment) => ({
          loanId: loan.id,
          loanName: loan.name,
          amountCents: payment.amountCents,
          isPaid: payment.isPaid,
        }))
    );

    const paidEntries = loans.flatMap((loan) =>
      loan.transactions
        .filter((transaction) => isSameDay(transaction.paidAt, date))
        .map((transaction) => ({
          loanId: loan.id,
          loanName: loan.name,
          amountCents: transaction.amountCents,
          kind: transaction.kind,
        }))
    );

    return {
      date,
      inCurrentMonth: date.getMonth() === firstOfMonth.getMonth(),
      dueEntries,
      paidEntries,
    };
  });
}
