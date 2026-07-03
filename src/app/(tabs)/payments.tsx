import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProgressBar } from '@/components/ui/progress-bar';
import { BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { isOpenStatus } from '@/lib/loan-status';
import { remainingDueCents } from '@/lib/schedule';
import { isSameMonth, monthLabel, sumTransactionsInMonth } from '@/lib/stats';

type PaymentEntry = {
  key: string;
  loanId: number;
  loanName: string;
  kind: 'installment' | 'extra';
  paidAt: Date;
  amountCents: number;
  principalAppliedCents: number;
  interestAppliedCents: number;
  /** Installment transactions only: the full amount of the month it went toward. */
  installmentAmountCents: number | null;
  onTime: boolean;
  daysLate: number;
  note: string | null;
};

export default function PaymentsScreen() {
  const theme = useTheme();
  const { format } = useDisplayMoney();
  const router = useRouter();

  const { data: loanList } = useLiveQuery(
    db.query.loans.findMany({
      with: {
        payments: { orderBy: (fields, { asc }) => [asc(fields.installmentNumber)] },
        transactions: true,
      },
    })
  );

  const allTransactions = useMemo(() => loanList.flatMap((loan) => loan.transactions), [loanList]);
  const activeLoans = loanList.filter((loan) => isOpenStatus(loan.status));
  const paidThisMonthCents = sumTransactionsInMonth(allTransactions);
  const now = new Date();
  const paymentsDueThisMonth = activeLoans.flatMap((loan) =>
    loan.payments.filter((payment) => isSameMonth(payment.dueDate, now))
  );
  const madeThisMonth = paymentsDueThisMonth.filter((payment) => payment.isPaid);
  const remainingCents = paymentsDueThisMonth.reduce(
    (sum, payment) => sum + remainingDueCents(payment),
    0
  );
  const dueThisMonthCents = paymentsDueThisMonth.reduce(
    (sum, payment) => sum + payment.amountCents,
    0
  );
  const monthProgress =
    dueThisMonthCents > 0 ? (dueThisMonthCents - remainingCents) / dueThisMonthCents : 0;

  const sections = useMemo(() => {
    const entries: PaymentEntry[] = loanList.flatMap((loan) =>
      loan.transactions.map((transaction) => {
        const row = transaction.paymentId
          ? loan.payments.find((payment) => payment.id === transaction.paymentId)
          : undefined;
        const daysLate =
          row && transaction.kind === 'installment'
            ? Math.max(
                0,
                Math.round(
                  (transaction.paidAt.getTime() - row.dueDate.getTime()) / 86_400_000
                )
              )
            : 0;

        return {
          key: `tx-${transaction.id}`,
          loanId: loan.id,
          loanName: loan.name,
          kind: transaction.kind,
          paidAt: transaction.paidAt,
          amountCents: transaction.amountCents,
          principalAppliedCents: transaction.principalAppliedCents,
          interestAppliedCents: transaction.interestAppliedCents,
          installmentAmountCents:
            row && transaction.kind === 'installment' ? row.amountCents : null,
          onTime: daysLate === 0,
          daysLate,
          note: transaction.note,
        };
      })
    );
    entries.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());

    const groups = new Map<string, PaymentEntry[]>();
    for (const entry of entries) {
      const key = monthLabel(entry.paidAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
  }, [loanList]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title">Payments</ThemedText>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.summaryRow}>
              <View>
                <ThemedText type="small" themeColor="textSecondary">
                  Paid in {monthLabel(now).split(' ')[0]}
                </ThemedText>
                <ThemedText type="title" numeric style={styles.summaryValue}>
                  {format(paidThisMonthCents)}
                </ThemedText>
              </View>
              <View style={styles.summaryRight}>
                <ThemedText type="small" themeColor="textSecondary">
                  Remaining
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  numeric
                  style={[styles.summaryRemaining, { color: theme.danger }]}>
                  {format(remainingCents)}
                </ThemedText>
              </View>
            </View>
            <ProgressBar progress={monthProgress} />
            <ThemedText type="small" themeColor="textSecondary">
              {madeThisMonth.length} of {paymentsDueThisMonth.length} payments made this month
            </ThemedText>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText themeColor="textSecondary">No payments logged yet.</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Mark a month paid on a loan to see it here.
                </ThemedText>
              </View>
            }
            renderSectionHeader={({ section }) => (
              <ThemedText type="sectionLabel" themeColor="textSecondary" style={styles.sectionHeader}>
                {section.title}
              </ThemedText>
            )}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeIn.duration(280).delay(Math.min(index * 30, 180))}>
                <Pressable
                  onPress={() => router.push(`/loan/${item.loanId}`)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View
                    style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View
                      style={[
                        styles.rowIcon,
                        { backgroundColor: item.onTime ? theme.successTint : theme.dangerTint },
                      ]}>
                      <SymbolView
                        tintColor={item.onTime ? theme.primary : theme.danger}
                        name={
                          item.kind === 'extra'
                            ? { ios: 'plus', android: 'add', web: 'add' }
                            : item.onTime
                              ? { ios: 'checkmark', android: 'check', web: 'check' }
                              : { ios: 'clock', android: 'schedule', web: 'schedule' }
                        }
                        size={15}
                      />
                    </View>
                    <View style={styles.rowLeading}>
                      <ThemedText type="smallBold" numberOfLines={1} style={styles.rowTitle}>
                        {item.loanName}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {item.kind === 'extra'
                          ? `${formatDate(item.paidAt)} · Extra payment → principal`
                          : item.installmentAmountCents !== null &&
                              item.amountCents < item.installmentAmountCents
                            ? `${formatDate(item.paidAt)} · Partial · ${format(item.amountCents)} of ${format(item.installmentAmountCents)}`
                            : item.onTime
                              ? `${formatDate(item.paidAt)} · ${format(item.principalAppliedCents)} principal + ${format(item.interestAppliedCents)} int`
                              : `${formatDate(item.paidAt)} · ${item.daysLate} day${item.daysLate === 1 ? '' : 's'} late`}
                      </ThemedText>
                      {item.note && (
                        <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                          {item.note}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark }}>
                      {format(item.amountCents)}
                    </ThemedText>
                  </View>
                </Pressable>
              </Animated.View>
            )}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
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
    paddingHorizontal: Spacing.three,
  },
  header: {
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three + 2,
    gap: Spacing.two + 2,
    marginBottom: Spacing.three,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryValue: {
    marginTop: 2,
  },
  summaryRemaining: {
    fontSize: 17,
    marginTop: 2,
  },
  sectionHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: Radii.row,
    padding: Spacing.three - 2,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLeading: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    fontSize: 15,
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
