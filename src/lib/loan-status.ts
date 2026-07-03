import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { loans, type LoanStatus } from '@/db/schema';

export function startOfToday(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** All paid → paid_off; any unpaid installment past due (before today) → overdue; else active. */
export function deriveLoanStatus(
  rows: { dueDate: Date; isPaid: boolean }[],
  now: Date = new Date()
): LoanStatus {
  if (rows.length === 0) return 'active';
  if (rows.every((row) => row.isPaid)) return 'paid_off';

  const today = startOfToday(now).getTime();
  const isOverdue = rows.some((row) => !row.isPaid && row.dueDate.getTime() < today);
  return isOverdue ? 'overdue' : 'active';
}

export function isOpenStatus(status: LoanStatus): boolean {
  return status === 'active' || status === 'overdue';
}

/** Recomputes and persists status for every loan. Skips no-op writes to avoid live-query churn. */
export async function refreshAllLoanStatuses(): Promise<void> {
  const allLoans = await db.query.loans.findMany({
    with: { payments: { columns: { dueDate: true, isPaid: true } } },
  });

  for (const loan of allLoans) {
    const nextStatus = deriveLoanStatus(loan.payments);
    if (nextStatus !== loan.status) {
      await db.update(loans).set({ status: nextStatus }).where(eq(loans.id, loan.id));
    }
  }
}
