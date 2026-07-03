import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProgressBar } from '@/components/ui/progress-bar';
import { BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { isOpenStatus } from '@/lib/loan-status';
import { getScheduleForLoan } from '@/lib/schedule';
import { isSameMonth, monthLabel, sumPaymentsInMonth } from '@/lib/stats';

type PaymentEntry = {
  key: string;
  loanId: number;
  loanName: string;
  paidAt: Date;
  amountCents: number;
  principalPortionCents: number;
  interestPortionCents: number;
  onTime: boolean;
  daysLate: number;
  note: string | null;
};

export default function PaymentsScreen() {
  const theme = useTheme();
  const currency = useCurrency();
  const router = useRouter();

  const { data: loanList } = useLiveQuery(
    db.query.loans.findMany({
      with: { payments: { orderBy: (fields, { asc }) => [asc(fields.installmentNumber)] } },
    })
  );

  const allPayments = useMemo(() => loanList.flatMap((loan) => loan.payments), [loanList]);
  const activeLoans = loanList.filter((loan) => isOpenStatus(loan.status));
  const paidThisMonthCents = sumPaymentsInMonth(allPayments);
  const now = new Date();
  const madeThisMonth = activeLoans.filter((loan) =>
    loan.payments.some((payment) => payment.isPaid && payment.paidAt && isSameMonth(payment.paidAt, now))
  );
  const remainingCents = activeLoans
    .filter((loan) => !madeThisMonth.includes(loan))
    .reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0);
  const monthProgress = activeLoans.length > 0 ? madeThisMonth.length / activeLoans.length : 0;

  const sections = useMemo(() => {
    const entries: PaymentEntry[] = loanList.flatMap((loan) =>
      getScheduleForLoan(loan.payments)
        .filter((entry) => entry.paid)
        .map((entry) => ({
          key: `${loan.id}-${entry.payment.id}`,
          loanId: loan.id,
          loanName: loan.name,
          paidAt: entry.payment.paidAt!,
          amountCents: entry.payment.amountCents,
          principalPortionCents: entry.payment.principalPortionCents,
          interestPortionCents: entry.payment.interestPortionCents,
          onTime: entry.onTime,
          daysLate: entry.daysLate,
          note: entry.payment.note,
        }))
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
                  {formatMoney(paidThisMonthCents, currency)}
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
                  {formatMoney(remainingCents, currency)}
                </ThemedText>
              </View>
            </View>
            <ProgressBar progress={monthProgress} />
            <ThemedText type="small" themeColor="textSecondary">
              {madeThisMonth.length} of {activeLoans.length} payments made this month
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
              <Animated.View entering={FadeInDown.duration(280).delay(Math.min(index * 30, 180))}>
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
                          item.onTime
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
                        {item.onTime
                          ? `${formatDate(item.paidAt)} · ${formatMoney(item.principalPortionCents, currency)} principal + ${formatMoney(item.interestPortionCents, currency)} int`
                          : `${formatDate(item.paidAt)} · ${item.daysLate} day${item.daysLate === 1 ? '' : 's'} late`}
                      </ThemedText>
                      {item.note && (
                        <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
                          {item.note}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark }}>
                      {formatMoney(item.amountCents, currency)}
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
