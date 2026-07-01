import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { loans, payments, reminders, type LoanStatus } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { cancelReminder, scheduleLoanReminder } from '@/lib/notifications';

const statusLabel: Record<LoanStatus, string> = {
  active: 'Active',
  paid_off: 'Paid off',
  overdue: 'Overdue',
};

type ScheduleEntry = {
  index: number;
  dueDate: Date;
  amountCents: number;
  paid: boolean;
};

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const theme = useTheme();
  const router = useRouter();

  const { data: loanResult } = useLiveQuery(
    db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        category: true,
        payments: { orderBy: (fields, { asc }) => [asc(fields.paidAt)] },
        reminders: true,
      },
    })
  );

  if (!loanResult) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">Loan not found.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const loan = loanResult;
  const paidCount = loan.payments.length;
  const nextUnpaidIndex = paidCount < loan.termMonths ? paidCount : null;
  const lastPaidIndex = paidCount > 0 ? paidCount - 1 : null;
  const reminder = loan.reminders[0];

  const schedule: ScheduleEntry[] = Array.from({ length: loan.termMonths }, (_, index) => {
    const payment = loan.payments[index];
    return {
      index,
      dueDate: payment ? payment.paidAt : addMonths(loan.startDate, index),
      amountCents: payment ? payment.amountCents : loan.monthlyPaymentCents,
      paid: Boolean(payment),
    };
  });

  async function rescheduleReminder(newDueDate: Date | null) {
    if (!reminder || !reminder.enabled) return;

    await cancelReminder(reminder.notificationId);
    const notificationId = newDueDate
      ? await scheduleLoanReminder({
          loanName: loan.name,
          amountLabel: formatMoney(loan.monthlyPaymentCents),
          dueDate: newDueDate,
          daysBefore: reminder.daysBefore,
        })
      : null;

    await db.update(reminders).set({ notificationId }).where(eq(reminders.id, reminder.id));
  }

  async function handleToggleReminder() {
    if (reminder) {
      const nextEnabled = !reminder.enabled;
      if (nextEnabled) {
        const notificationId = await scheduleLoanReminder({
          loanName: loan.name,
          amountLabel: formatMoney(loan.monthlyPaymentCents),
          dueDate: loan.nextDueDate,
          daysBefore: reminder.daysBefore,
        });
        await db
          .update(reminders)
          .set({ enabled: true, notificationId })
          .where(eq(reminders.id, reminder.id));
      } else {
        await cancelReminder(reminder.notificationId);
        await db
          .update(reminders)
          .set({ enabled: false, notificationId: null })
          .where(eq(reminders.id, reminder.id));
      }
      return;
    }

    const settings = await db.query.appSettings.findFirst();
    const daysBefore = settings?.reminderDaysBefore ?? 3;
    const notificationId = await scheduleLoanReminder({
      loanName: loan.name,
      amountLabel: formatMoney(loan.monthlyPaymentCents),
      dueDate: loan.nextDueDate,
      daysBefore,
    });
    await db.insert(reminders).values({
      loanId: loan.id,
      daysBefore,
      enabled: true,
      notificationId,
    });
  }

  async function handleMarkPaid() {
    if (nextUnpaidIndex === null) return;

    const principalPortionCents = Math.round(loan.principalCents / loan.termMonths);
    const interestPortionCents = loan.monthlyPaymentCents - principalPortionCents;
    const now = new Date();
    const newPaidCount = paidCount + 1;
    const isFullyPaid = newPaidCount >= loan.termMonths;
    const newDueDate = addMonths(loan.startDate, isFullyPaid ? newPaidCount - 1 : newPaidCount);

    await db.insert(payments).values({
      loanId: loan.id,
      amountCents: loan.monthlyPaymentCents,
      principalPortionCents,
      interestPortionCents,
      paidAt: now,
    });

    await db
      .update(loans)
      .set({
        nextDueDate: newDueDate,
        status: isFullyPaid ? 'paid_off' : 'active',
        updatedAt: now,
      })
      .where(eq(loans.id, loan.id));

    await rescheduleReminder(isFullyPaid ? null : newDueDate);
  }

  async function handleUndoLastPayment() {
    if (lastPaidIndex === null) return;
    const lastPayment = loan.payments[lastPaidIndex];
    const newDueDate = addMonths(loan.startDate, lastPaidIndex);

    await db.delete(payments).where(eq(payments.id, lastPayment.id));
    await db
      .update(loans)
      .set({
        nextDueDate: newDueDate,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(loans.id, loan.id));

    await rescheduleReminder(newDueDate);
  }

  function handleDelete() {
    Alert.alert('Delete loan', `Delete "${loan.name}"? This also removes its payment history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (reminder?.notificationId) {
            await cancelReminder(reminder.notificationId);
          }
          await db.delete(loans).where(eq(loans.id, loan.id));
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: loan.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={handleToggleReminder} hitSlop={8}>
                <SymbolView
                  tintColor={theme.text}
                  name={{
                    ios: reminder?.enabled ? 'bell.fill' : 'bell',
                    android: reminder?.enabled ? 'notifications_active' : 'notifications_none',
                    web: reminder?.enabled ? 'notifications_active' : 'notifications_none',
                  }}
                  size={20}
                />
              </Pressable>
              <Pressable onPress={() => router.push(`/loan/${loan.id}/edit`)} hitSlop={8}>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                  size={20}
                />
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={8}>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  size={20}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <FlatList
            data={schedule}
            keyExtractor={(item) => String(item.index)}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  {loan.category?.color && (
                    <View style={[styles.dot, { backgroundColor: loan.category.color }]} />
                  )}
                  <ThemedText type="small" themeColor="textSecondary">
                    {[loan.category?.name, loan.lender].filter(Boolean).join(' · ') ||
                      'Uncategorized'}
                  </ThemedText>
                </View>

                <View style={styles.statsGrid}>
                  <Stat label="Principal" value={formatMoney(loan.principalCents)} />
                  <Stat label="Monthly payment" value={formatMoney(loan.monthlyPaymentCents)} />
                  <Stat label="Interest / mo" value={`${loan.interestRate}%`} />
                  <Stat label="Term" value={`${loan.termMonths} months`} />
                  <Stat label="Start date" value={formatDate(loan.startDate)} />
                  <Stat label="Status" value={statusLabel[loan.status]} />
                </View>

                {loan.notes && (
                  <ThemedView type="backgroundElement" style={styles.notesBox}>
                    <ThemedText type="small">{loan.notes}</ThemedText>
                  </ThemedView>
                )}

                <ThemedText type="small" themeColor="textSecondary" style={styles.scheduleLabel}>
                  Payment schedule ({paidCount}/{loan.termMonths} paid)
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => {
              const isNextUnpaid = item.index === nextUnpaidIndex;
              const isLastPaid = item.index === lastPaidIndex;
              const interactive = isNextUnpaid || isLastPaid;

              const row = (
                <View style={[styles.scheduleRow, { borderBottomColor: theme.backgroundSelected }]}>
                  <View style={styles.scheduleLeading}>
                    <ThemedText>Month {item.index + 1}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDate(item.dueDate)}
                    </ThemedText>
                  </View>
                  <View style={styles.scheduleTrailing}>
                    <ThemedText themeColor={item.paid ? 'text' : 'textSecondary'}>
                      {formatMoney(item.amountCents)}
                    </ThemedText>
                    {item.paid ? (
                      <SymbolView
                        tintColor={theme.text}
                        name={{
                          ios: 'checkmark.circle.fill',
                          android: 'check_circle',
                          web: 'check_circle',
                        }}
                        size={18}
                      />
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary">
                        Upcoming
                      </ThemedText>
                    )}
                  </View>
                </View>
              );

              if (!interactive) return row;

              return (
                <Pressable
                  onPress={isNextUnpaid ? handleMarkPaid : handleUndoLastPayment}
                  style={({ pressed }) => pressed && styles.pressed}>
                  {row}
                </Pressable>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  header: {
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.three,
    gap: Spacing.four,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  stat: {
    gap: Spacing.half,
    minWidth: 120,
  },
  notesBox: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
  },
  scheduleLabel: {
    paddingTop: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scheduleLeading: {
    gap: Spacing.half,
  },
  scheduleTrailing: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
});
