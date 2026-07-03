import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalanceChart } from '@/components/charts/balance-chart';
import { CategoryBars } from '@/components/charts/category-bars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ProgressRing } from '@/components/ui/progress-ring';
import { BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import {
  buildBalanceTimeline,
  categoryBreakdown,
  interestSplit,
  projectedDebtFreeDate,
} from '@/lib/analytics';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';

export default function InsightsScreen() {
  const theme = useTheme();
  const currency = useCurrency();

  const { data: loans } = useLiveQuery(
    db.query.loans.findMany({ with: { payments: true, category: true } })
  );

  const balanceTimeline = useMemo(() => buildBalanceTimeline(loans), [loans]);
  const debtFreeDate = useMemo(() => projectedDebtFreeDate(loans), [loans]);
  const allPayments = useMemo(() => loans.flatMap((loan) => loan.payments), [loans]);
  const interest = useMemo(() => interestSplit(allPayments), [allPayments]);
  const categories = useMemo(() => categoryBreakdown(loans), [loans]);

  const totalPrincipalCents = loans.reduce((sum, loan) => sum + loan.principalCents, 0);
  const paidPrincipalCents = loans.reduce(
    (sum, loan) =>
      sum + loan.payments.reduce((paid, payment) => paid + (payment.isPaid ? payment.principalPortionCents : 0), 0),
    0
  );
  const overallProgress = totalPrincipalCents > 0 ? paidPrincipalCents / totalPrincipalCents : 0;
  const totalInterestCents = interest.paidCents + interest.remainingCents;

  if (loans.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="title">Insights</ThemedText>
            </View>
            <View style={styles.emptyState}>
              <ThemedText themeColor="textSecondary">No loans yet.</ThemedText>
              <ThemedText themeColor="textSecondary">Add a loan to see insights here.</ThemedText>
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="title">Insights</ThemedText>
          </View>

          <View style={[styles.card, styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.heroRing}>
              <ProgressRing progress={overallProgress} size={104} strokeWidth={10}>
                <ThemedText type="display" numeric style={{ fontSize: 24, color: theme.primaryDark }}>
                  {Math.round(overallProgress * 100)}%
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  paid off
                </ThemedText>
              </ProgressRing>
            </View>
            <View style={styles.heroTextGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {debtFreeDate ? 'Projected debt-free date' : 'All loans paid off'}
              </ThemedText>
              <ThemedText type="subtitle" style={styles.heroValue}>
                {debtFreeDate ? formatDate(debtFreeDate) : '🎉'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatMoney(paidPrincipalCents, currency)} of {formatMoney(totalPrincipalCents, currency)} principal paid
              </ThemedText>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Balance over time
            </ThemedText>
            <BalanceChart points={balanceTimeline} />
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Interest paid vs. remaining
            </ThemedText>
            <ProgressBar progress={totalInterestCents > 0 ? interest.paidCents / totalInterestCents : 0} height={10} />
            <View style={styles.interestRow}>
              <View>
                <ThemedText type="small" themeColor="textSecondary">
                  Paid
                </ThemedText>
                <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark }}>
                  {formatMoney(interest.paidCents, currency)}
                </ThemedText>
              </View>
              <View style={styles.interestRight}>
                <ThemedText type="small" themeColor="textSecondary">
                  Remaining
                </ThemedText>
                <ThemedText type="smallBold" numeric themeColor="danger">
                  {formatMoney(interest.remainingCents, currency)}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              By category
            </ThemedText>
            <CategoryBars slices={categories} />
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three - 2,
  },
  header: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.six,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three + 2,
    gap: Spacing.two + 2,
  },
  cardTitle: {
    fontSize: 15,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextGroup: {
    flex: 1,
    gap: 2,
  },
  heroValue: {
    fontSize: 20,
  },
  interestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  interestRight: {
    alignItems: 'flex-end',
  },
});
