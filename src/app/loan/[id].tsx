import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { loans, payments, type LoanStatus } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { addMonths, formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';

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

  const { data: loanResult } = useLiveQuery(
    db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        category: true,
        payments: { orderBy: (fields, { asc }) => [asc(fields.paidAt)] },
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

  const schedule: ScheduleEntry[] = Array.from({ length: loan.termMonths }, (_, index) => {
    const payment = loan.payments[index];
    return {
      index,
      dueDate: payment ? payment.paidAt : addMonths(loan.startDate, index),
      amountCents: payment ? payment.amountCents : loan.monthlyPaymentCents,
      paid: Boolean(payment),
    };
  });

  async function handleMarkPaid() {
    if (nextUnpaidIndex === null) return;

    const principalPortionCents = Math.round(loan.principalCents / loan.termMonths);
    const interestPortionCents = loan.monthlyPaymentCents - principalPortionCents;
    const now = new Date();
    const newPaidCount = paidCount + 1;
    const isFullyPaid = newPaidCount >= loan.termMonths;

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
        nextDueDate: addMonths(loan.startDate, isFullyPaid ? newPaidCount - 1 : newPaidCount),
        status: isFullyPaid ? 'paid_off' : 'active',
        updatedAt: now,
      })
      .where(eq(loans.id, loan.id));
  }

  async function handleUndoLastPayment() {
    if (lastPaidIndex === null) return;
    const lastPayment = loan.payments[lastPaidIndex];

    await db.delete(payments).where(eq(payments.id, lastPayment.id));
    await db
      .update(loans)
      .set({
        nextDueDate: addMonths(loan.startDate, lastPaidIndex),
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(loans.id, loan.id));
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: loan.name }} />
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
