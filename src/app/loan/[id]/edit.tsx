import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { LoanForm } from '@/components/loan-form';
import { db } from '@/db/client';
import { loans } from '@/db/schema';

export default function EditLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const router = useRouter();

  const { data: loan } = useLiveQuery(db.query.loans.findFirst({ where: eq(loans.id, loanId) }));

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
      }}
      onSubmit={async (values) => {
        await db
          .update(loans)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(loans.id, loan.id));
        router.back();
      }}
    />
  );
}
