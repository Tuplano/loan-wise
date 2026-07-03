import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { loans, payments, paymentTransactions, reminders } from '@/db/schema';
import { convertCentsSync } from '@/lib/exchange-rates';
import { formatMoney } from '@/lib/format';
import { deriveLoanStatus } from '@/lib/loan-status';
import { cancelReminder, scheduleLoanReminder } from '@/lib/notifications';
import {
  allocatePaymentToInstallment,
  computeNextDueDate,
  extraPaymentCapacityCents,
  rebuildUnpaidInstallments,
  remainingDueCents,
} from '@/lib/schedule';

import type { TransactionKind } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Principal already knocked off the schedule tail by extra payments (standalone or overpay overflow). */
export function sumExtraPrincipal(
  transactions: { kind: TransactionKind; principalAppliedCents: number }[]
): number {
  return transactions.reduce(
    (sum, transaction) =>
      transaction.kind === 'extra' ? sum + transaction.principalAppliedCents : sum,
    0
  );
}

type SyncResult = {
  loanName: string;
  monthlyPaymentCents: number;
  nextDueDate: Date;
  isPaidOff: boolean;
  reminder: { id: number; daysBefore: number; enabled: boolean; notificationId: string | null } | null;
};

/**
 * Recomputes a loan's derived state after any money movement: regenerates the fully-unpaid
 * schedule tail (extra principal shortens it, undo regrows it), then refreshes nextDueDate
 * and status. Runs inside the caller's transaction; reminder rescheduling is returned to the
 * caller because it touches native APIs that must stay outside the transaction.
 */
async function syncLoanSchedule(tx: Tx, loanId: number): Promise<SyncResult | null> {
  const loan = await tx.query.loans.findFirst({
    where: eq(loans.id, loanId),
    with: { payments: true, transactions: true, reminders: true },
  });
  if (!loan) return null;

  const extraPrincipalCents = sumExtraPrincipal(loan.transactions);
  const lockedRows = loan.payments.filter((row) => row.paidCents > 0);
  const unpaidRows = loan.payments.filter((row) => row.paidCents === 0);
  const drafts = rebuildUnpaidInstallments(loan, lockedRows, extraPrincipalCents);

  // Skip the delete+insert when the tail already matches — keeps unpaid rows (and their
  // notes) stable across partial payments, which never reshape the schedule.
  const tailUnchanged =
    drafts.length === unpaidRows.length &&
    drafts.every((draft) => {
      const row = unpaidRows.find((r) => r.installmentNumber === draft.installmentNumber);
      return (
        !!row &&
        row.amountCents === draft.amountCents &&
        row.principalPortionCents === draft.principalPortionCents &&
        row.interestPortionCents === draft.interestPortionCents &&
        row.dueDate.getTime() === draft.dueDate.getTime()
      );
    });

  if (!tailUnchanged) {
    if (unpaidRows.length > 0) {
      await tx.delete(payments).where(inArray(payments.id, unpaidRows.map((row) => row.id)));
    }
    if (drafts.length > 0) {
      await tx.insert(payments).values(drafts.map((draft) => ({ loanId, ...draft })));
    }
  }

  const rowsAfter = [
    ...lockedRows.map((row) => ({
      installmentNumber: row.installmentNumber,
      dueDate: row.dueDate,
      isPaid: row.isPaid,
    })),
    ...drafts.map((draft) => ({
      installmentNumber: draft.installmentNumber,
      dueDate: draft.dueDate,
      isPaid: false,
    })),
  ];
  const nextDueDate = rowsAfter.length > 0 ? computeNextDueDate(rowsAfter) : loan.nextDueDate;
  const status = deriveLoanStatus(rowsAfter);

  await tx
    .update(loans)
    .set({ nextDueDate, status, updatedAt: new Date() })
    .where(eq(loans.id, loanId));

  return {
    loanName: loan.name,
    monthlyPaymentCents: loan.monthlyPaymentCents,
    nextDueDate,
    isPaidOff: status === 'paid_off',
    reminder: loan.reminders[0] ?? null,
  };
}

async function rescheduleReminderAfterSync(result: SyncResult | null): Promise<void> {
  if (!result?.reminder?.enabled) return;

  await cancelReminder(result.reminder.notificationId);
  let notificationId: string | null = null;
  if (!result.isPaidOff) {
    const settings = await db.query.appSettings.findFirst();
    const currency = settings?.currency ?? 'PHP';
    notificationId = await scheduleLoanReminder({
      loanName: result.loanName,
      amountLabel: formatMoney(convertCentsSync(result.monthlyPaymentCents, currency), currency),
      dueDate: result.nextDueDate,
      daysBefore: result.reminder.daysBefore,
    });
  }
  await db.update(reminders).set({ notificationId }).where(eq(reminders.id, result.reminder.id));
}

/**
 * Applies money to one installment. Covers interest first, then principal; anything beyond the
 * row's remaining due becomes a paired 'extra' transaction (same paymentId) that goes straight
 * to principal and shortens the schedule tail.
 */
export async function applyInstallmentPayment(options: {
  loanId: number;
  paymentId: number;
  amountCents: number;
  paidAt: Date;
  note?: string | null;
}): Promise<void> {
  if (options.amountCents <= 0) return;

  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, options.loanId),
    with: { payments: true, transactions: true },
  });
  const row = loan?.payments.find((payment) => payment.id === options.paymentId);
  if (!loan || !row) return;

  const allocation = allocatePaymentToInstallment(row, options.amountCents);
  const installmentAmount = Math.min(options.amountCents, remainingDueCents(row));

  // Overflow can only absorb principal still in the tail — this row's own portion leaves
  // the tail the moment money lands on it.
  const rowsAfterLock = loan.payments.map((payment) =>
    payment.id === row.id ? { ...payment, paidCents: Math.max(payment.paidCents, 1) } : payment
  );
  const overflowCap = extraPaymentCapacityCents(
    loan,
    rowsAfterLock,
    sumExtraPrincipal(loan.transactions)
  );
  const overflowCents = Math.min(allocation.overflowCents, overflowCap);

  let syncResult: SyncResult | null = null;
  await db.transaction(async (tx) => {
    if (installmentAmount > 0) {
      await tx.insert(paymentTransactions).values({
        loanId: options.loanId,
        paymentId: options.paymentId,
        kind: 'installment',
        amountCents: installmentAmount,
        principalAppliedCents: allocation.principalAppliedCents,
        interestAppliedCents: allocation.interestAppliedCents,
        paidAt: options.paidAt,
        note: options.note ?? null,
      });
    }
    if (overflowCents > 0) {
      await tx.insert(paymentTransactions).values({
        loanId: options.loanId,
        paymentId: options.paymentId,
        kind: 'extra',
        amountCents: overflowCents,
        principalAppliedCents: overflowCents,
        interestAppliedCents: 0,
        paidAt: options.paidAt,
        note: options.note ?? null,
      });
    }

    const newPaidCents = row.paidCents + installmentAmount;
    const settled = newPaidCents >= row.amountCents;
    await tx
      .update(payments)
      .set({
        paidCents: newPaidCents,
        isPaid: settled,
        paidAt: settled ? options.paidAt : row.paidAt,
      })
      .where(eq(payments.id, options.paymentId));

    syncResult = await syncLoanSchedule(tx, options.loanId);
  });
  await rescheduleReminderAfterSync(syncResult);
}

/** Logs a standalone extra payment — all principal, clamped to what the schedule tail can absorb. */
export async function applyExtraPayment(options: {
  loanId: number;
  amountCents: number;
  paidAt: Date;
  note?: string | null;
}): Promise<void> {
  if (options.amountCents <= 0) return;

  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, options.loanId),
    with: { payments: true, transactions: true },
  });
  if (!loan) return;

  const capacity = extraPaymentCapacityCents(loan, loan.payments, sumExtraPrincipal(loan.transactions));
  const amountCents = Math.min(options.amountCents, capacity);
  if (amountCents <= 0) return;

  let syncResult: SyncResult | null = null;
  await db.transaction(async (tx) => {
    await tx.insert(paymentTransactions).values({
      loanId: options.loanId,
      paymentId: null,
      kind: 'extra',
      amountCents,
      principalAppliedCents: amountCents,
      interestAppliedCents: 0,
      paidAt: options.paidAt,
      note: options.note ?? null,
    });
    syncResult = await syncLoanSchedule(tx, options.loanId);
  });
  await rescheduleReminderAfterSync(syncResult);
}

/** Reverses every transaction on an installment (including a paired overpay-overflow 'extra')
 * and regrows the schedule tail accordingly. */
export async function undoInstallmentPayments(paymentId: number): Promise<void> {
  const row = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: { transactions: true },
  });
  if (!row) return;

  let syncResult: SyncResult | null = null;
  await db.transaction(async (tx) => {
    if (row.transactions.length > 0) {
      await tx.delete(paymentTransactions).where(
        inArray(paymentTransactions.id, row.transactions.map((transaction) => transaction.id))
      );
    }
    await tx
      .update(payments)
      .set({ paidCents: 0, isPaid: false, paidAt: null })
      .where(eq(payments.id, paymentId));

    syncResult = await syncLoanSchedule(tx, row.loanId);
  });
  await rescheduleReminderAfterSync(syncResult);
}
