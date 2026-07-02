import { useRouter } from 'expo-router';

import { LoanForm } from '@/components/loan-form';
import { db } from '@/db/client';
import { loans, reminders } from '@/db/schema';
import { formatMoney } from '@/lib/format';
import { scheduleLoanReminder } from '@/lib/notifications';

export default function AddLoanScreen() {
  const router = useRouter();

  return (
    <LoanForm
      title="Add Loan"
      onSubmit={async (values) => {
        const [createdLoan] = await db
          .insert(loans)
          .values({ ...values, nextDueDate: values.firstPaymentDate })
          .returning();

        const settings = await db.query.appSettings.findFirst();
        if (settings?.remindersEnabled) {
          const notificationId = await scheduleLoanReminder({
            loanName: createdLoan.name,
            amountLabel: formatMoney(createdLoan.monthlyPaymentCents, settings.currency),
            dueDate: createdLoan.nextDueDate,
            daysBefore: settings.reminderDaysBefore,
          });
          await db.insert(reminders).values({
            loanId: createdLoan.id,
            daysBefore: settings.reminderDaysBefore,
            enabled: true,
            notificationId,
          });
        }

        router.back();
      }}
    />
  );
}
