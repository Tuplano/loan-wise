import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PillBadge } from '@/components/ui/pill-badge';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { loans, payments, reminders, type LoanStatus } from '@/db/schema';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, formatDate, ordinalSuffix } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { cancelReminder, scheduleLoanReminder } from '@/lib/notifications';
import { getScheduleForLoan, scheduleAnchor } from '@/lib/schedule';

const statusLabel: Record<LoanStatus, string> = {
  active: 'Active',
  paid_off: 'Paid off',
  overdue: 'Overdue',
};

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const theme = useTheme();
  const currency = useCurrency();
  const router = useRouter();
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

  const schedule = getScheduleForLoan(loan, loan.payments);

  const principalPaidCents = loan.payments.reduce(
    (sum, payment) => sum + (payment.principalPortionCents ?? 0),
    0
  );
  const remainingCents = Math.max(loan.principalCents - principalPaidCents, 0);
  const paidOffProgress =
    loan.principalCents > 0 ? Math.min(principalPaidCents / loan.principalCents, 1) : 0;

  const basePaymentCents = Math.round(loan.principalCents / loan.termMonths);
  const interestPaymentCents = loan.monthlyPaymentCents - basePaymentCents;

  async function rescheduleReminder(newDueDate: Date | null) {
    if (!reminder || !reminder.enabled) return;

    await cancelReminder(reminder.notificationId);
    const notificationId = newDueDate
      ? await scheduleLoanReminder({
          loanName: loan.name,
          amountLabel: formatMoney(loan.monthlyPaymentCents, currency),
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
          amountLabel: formatMoney(loan.monthlyPaymentCents, currency),
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
      amountLabel: formatMoney(loan.monthlyPaymentCents, currency),
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
    if (nextUnpaidIndex === null || isProcessingPayment) return;
    setIsProcessingPayment(true);

    try {
      const principalPortionCents = Math.round(loan.principalCents / loan.termMonths);
      const interestPortionCents = loan.monthlyPaymentCents - principalPortionCents;
      const now = new Date();
      const newPaidCount = paidCount + 1;
      const isFullyPaid = newPaidCount >= loan.termMonths;
      const newDueDate = addMonths(scheduleAnchor(loan), isFullyPaid ? newPaidCount - 1 : newPaidCount);

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
    } finally {
      setIsProcessingPayment(false);
    }
  }

  async function handleUndoLastPayment() {
    if (lastPaidIndex === null || isProcessingPayment) return;
    setIsProcessingPayment(true);

    try {
      const lastPayment = loan.payments[lastPaidIndex];
      const newDueDate = addMonths(scheduleAnchor(loan), lastPaidIndex);

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
    } finally {
      setIsProcessingPayment(false);
    }
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
                  tintColor={theme.primary}
                  name={{
                    ios: reminder?.enabled ? 'bell.fill' : 'bell',
                    android: reminder?.enabled ? 'notifications_active' : 'notifications_none',
                    web: reminder?.enabled ? 'notifications_active' : 'notifications_none',
                  }}
                  size={20}
                />
              </Pressable>
              <Pressable onPress={() => router.push(`/loan/${loan.id}/edit`)} hitSlop={8}>
                <ThemedText type="linkPrimary">Edit</ThemedText>
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={8}>
                <SymbolView
                  tintColor={theme.danger}
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
            style={styles.list}
            data={schedule}
            keyExtractor={(item) => String(item.index)}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.header}>
                <View style={styles.titleBlock}>
                  <PillBadge
                    label={loan.category?.name ?? statusLabel[loan.status]}
                    color={loan.category?.color ?? undefined}
                  />
                  <ThemedText type="title" style={styles.titleText}>
                    {loan.name}
                  </ThemedText>
                  {loan.lender && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {loan.lender}
                    </ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textMuted">
                    Started {formatDate(loan.startDate)} · Due every{' '}
                    {scheduleAnchor(loan).getDate()}
                    {ordinalSuffix(scheduleAnchor(loan).getDate())}
                  </ThemedText>
                </View>

                <View style={styles.ringWrap}>
                  <ProgressRing progress={paidOffProgress} size={168} strokeWidth={14}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Paid off
                    </ThemedText>
                    <ThemedText type="display" numeric style={{ color: theme.primaryDark }}>
                      {Math.round(paidOffProgress * 100)}%
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numeric>
                      {formatMoney(principalPaidCents, currency)} of {formatMoney(loan.principalCents, currency)}
                    </ThemedText>
                  </ProgressRing>
                </View>

                <View style={styles.statsGrid}>
                  <StatCard label="Principal" value={formatMoney(loan.principalCents, currency)} />
                  <StatCard label="Monthly" value={formatMoney(loan.monthlyPaymentCents, currency)} />
                </View>

                <View style={[styles.breakdownCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.breakdownTitle}>
                    Payment breakdown
                  </ThemedText>
                  <View style={styles.breakdownRow}>
                    <ThemedText type="small">
                      Base ({formatMoney(loan.principalCents, currency)} ÷ {loan.termMonths} mo)
                    </ThemedText>
                    <ThemedText type="smallBold" numeric>
                      {formatMoney(basePaymentCents, currency)}
                    </ThemedText>
                  </View>
                  <View style={styles.breakdownRow}>
                    <ThemedText type="small">Interest ({loan.interestRate}% / mo)</ThemedText>
                    <ThemedText type="smallBold" numeric>
                      {formatMoney(interestPaymentCents, currency)}
                    </ThemedText>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotal, { borderTopColor: theme.divider }]}>
                    <ThemedText type="smallBold">Monthly due</ThemedText>
                    <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark }}>
                      {formatMoney(loan.monthlyPaymentCents, currency)}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.miniStatsRow}>
                  <MiniStat value={`${loan.termMonths} mo`} label="Term" />
                  <MiniStat value={`${Math.max(loan.termMonths - paidCount, 0)} mo`} label="Left" />
                  <MiniStat value={`${loan.interestRate}%`} label="Interest" />
                </View>

                {loan.notes && (
                  <View style={[styles.notesBox, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">{loan.notes}</ThemedText>
                  </View>
                )}

                <ThemedText type="smallBold" style={styles.scheduleLabel}>
                  Payment schedule ({paidCount}/{loan.termMonths} paid)
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => {
              const isLastPaid = item.index === lastPaidIndex;
              // Marking paid happens only through the "Log payment" button below —
              // the row itself only supports tap-to-undo on the most recent payment.
              const interactive = isLastPaid;

              const row = (
                <View style={[styles.scheduleRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View
                    style={[
                      styles.scheduleIcon,
                      { backgroundColor: item.paid ? theme.successTint : theme.backgroundElement },
                    ]}>
                    {item.paid ? (
                      <SymbolView
                        tintColor={theme.primary}
                        name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                        size={15}
                      />
                    ) : (
                      <ThemedText type="smallBold" themeColor="textSecondary">
                        {item.index + 1}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.scheduleLeading}>
                    <ThemedText type="smallBold">Month {item.index + 1}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDate(item.dueDate)}
                    </ThemedText>
                  </View>
                  <View style={styles.scheduleTrailing}>
                    <ThemedText type="smallBold" numeric themeColor={item.paid ? 'text' : 'textSecondary'}>
                      {formatMoney(item.amountCents, currency)}
                    </ThemedText>
                    {!item.paid && (
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
                  onPress={handleUndoLastPayment}
                  style={({ pressed }) => pressed && styles.pressed}>
                  {row}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          />

          {nextUnpaidIndex !== null && (
            <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
              <PrimaryButton
                label="Log payment"
                onPress={handleMarkPaid}
                disabled={isProcessingPayment}
                size="large"
              />
            </View>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numeric style={styles.statCardValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.miniStat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ThemedText type="smallBold" numeric style={styles.statCardValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  header: {
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  titleText: {
    marginTop: Spacing.one,
  },
  ringWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.row - 2,
    padding: Spacing.three - 3,
  },
  statCardValue: {
    fontSize: 17,
    marginTop: 2,
  },
  breakdownCard: {
    borderWidth: 1,
    borderRadius: Radii.card - 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  breakdownTitle: {
    marginBottom: Spacing.one,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownTotal: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  miniStatsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radii.row - 2,
    paddingVertical: Spacing.two + 2,
  },
  notesBox: {
    borderRadius: Radii.row - 2,
    padding: Spacing.three,
  },
  scheduleLabel: {
    paddingTop: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: Radii.row,
    padding: Spacing.three - 3,
  },
  scheduleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleLeading: {
    flex: 1,
    gap: 1,
  },
  scheduleTrailing: {
    alignItems: 'flex-end',
    gap: 1,
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
