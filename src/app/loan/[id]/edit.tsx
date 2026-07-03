import { and, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { LoanForm } from '@/components/loan-form';
import { db } from '@/db/client';
import { loans, payments } from '@/db/schema';
import { formatMoney } from '@/lib/format';
import { deriveLoanStatus } from '@/lib/loan-status';
import { sumExtraPrincipal } from '@/lib/payment-actions';
import { computeNextDueDate, rebuildUnpaidInstallments } from '@/lib/schedule';

export default function EditLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const router = useRouter();

  const { data: loan } = useLiveQuery(
    db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: { payments: true, transactions: true },
    })
  );

  if (!loan) return null;

  return (
    <LoanForm
      title="Edit Loan"
      initialValues={{
        name: loan.name,
        lender: loan.lender,
        categoryId: loan.categoryId,
        principal: String(loan.principalCents / 100),
        termMonths: String(loan.termMonths),
        interestRate: String(loan.interestRate),
        notes: loan.notes,
        startDate: loan.startDate,
        firstPaymentDate: loan.firstPaymentDate ?? loan.startDate,
      }}
      onSubmit={async (values) => {
        // Rows with any money applied (paid or partial) are locked — history is never rewritten.
        const lockedRows = loan.payments.filter((payment) => payment.paidCents > 0);
        const maxLockedInstallment = lockedRows.reduce(
          (max, payment) => Math.max(max, payment.installmentNumber),
          0
        );

        if (values.termMonths < maxLockedInstallment) {
          Alert.alert(
            'Term too short',
            `Month ${maxLockedInstallment} already has payments, so the term can't be shorter than ${maxLockedInstallment} months.`
          );
          return;
        }

        const appliedPrincipalCents = loan.transactions.reduce(
          (sum, transaction) => sum + transaction.principalAppliedCents,
          0
        );
        if (values.principalCents < appliedPrincipalCents) {
          Alert.alert(
            'Principal too low',
            `${formatMoney(appliedPrincipalCents)} has already been paid toward the principal, so it can't be lower than that.`
          );
          return;
        }

        const extraPrincipalCents = sumExtraPrincipal(loan.transactions);
        const rowsToInsert = rebuildUnpaidInstallments(values, lockedRows, extraPrincipalCents).map(
          (installment) => ({ loanId: loan.id, ...installment })
        );

        // Unpaid installments are fully regenerated from the new term/amount/anchor,
        // still honoring any extra principal already applied; locked ones stay untouched.
        await db
          .delete(payments)
          .where(and(eq(payments.loanId, loan.id), eq(payments.paidCents, 0)));
        if (rowsToInsert.length > 0) {
          await db.insert(payments).values(rowsToInsert);
        }

        const scheduleRows = [
          ...lockedRows.map((payment) => ({
            installmentNumber: payment.installmentNumber,
            dueDate: payment.dueDate,
            isPaid: payment.isPaid,
          })),
          ...rowsToInsert.map((installment) => ({
            installmentNumber: installment.installmentNumber,
            dueDate: installment.dueDate,
            isPaid: false,
          })),
        ];
        const nextDueDate =
          scheduleRows.length > 0 ? computeNextDueDate(scheduleRows) : values.firstPaymentDate;
        const status = deriveLoanStatus(scheduleRows);

        await db
          .update(loans)
          .set({
            ...values,
            nextDueDate,
            status,
            updatedAt: new Date(),
          })
          .where(eq(loans.id, loan.id));
        router.back();
      }}
    />
  );
}
