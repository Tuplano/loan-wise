import { and, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { LoanForm } from '@/components/loan-form';
import { db } from '@/db/client';
import { loans, payments } from '@/db/schema';
import { deriveLoanStatus } from '@/lib/loan-status';
import { buildInstallmentSchedule, computeNextDueDate } from '@/lib/schedule';

export default function EditLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const router = useRouter();

  const { data: loan } = useLiveQuery(
    db.query.loans.findFirst({ where: eq(loans.id, loanId), with: { payments: true } })
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
        const paidRows = loan.payments.filter((payment) => payment.isPaid);
        const maxPaidInstallment = paidRows.reduce(
          (max, payment) => Math.max(max, payment.installmentNumber),
          0
        );

        if (values.termMonths < maxPaidInstallment) {
          Alert.alert(
            'Term too short',
            `Month ${maxPaidInstallment} is already marked paid, so the term can't be shorter than ${maxPaidInstallment} months.`
          );
          return;
        }

        const paidNumbers = new Set(paidRows.map((payment) => payment.installmentNumber));
        const desiredSchedule = buildInstallmentSchedule(values);
        const rowsToInsert = desiredSchedule
          .filter((installment) => !paidNumbers.has(installment.installmentNumber))
          .map((installment) => ({ loanId: loan.id, ...installment }));

        // Unpaid installments are fully regenerated from the new term/amount/anchor;
        // paid ones are left untouched so history doesn't get rewritten retroactively.
        await db
          .delete(payments)
          .where(and(eq(payments.loanId, loan.id), eq(payments.isPaid, false)));
        if (rowsToInsert.length > 0) {
          await db.insert(payments).values(rowsToInsert);
        }

        const scheduleRows = desiredSchedule.map((installment) => ({
          installmentNumber: installment.installmentNumber,
          dueDate: installment.dueDate,
          isPaid: paidNumbers.has(installment.installmentNumber),
        }));
        const nextDueDate = computeNextDueDate(scheduleRows);
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
