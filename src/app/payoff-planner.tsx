import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalanceChart } from '@/components/charts/balance-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';
import { isOpenStatus } from '@/lib/loan-status';
import { BASE_CURRENCY } from '@/lib/exchange-rates';
import { comparePayoffStrategies, type PayoffPlan, type PayoffStrategy } from '@/lib/payoff-planner';
import { monthLabel } from '@/lib/stats';

import type { LoanBalanceLine } from '@/lib/analytics';

function toCents(value: string) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

const strategyBlurb: Record<PayoffStrategy, string> = {
  snowball: 'Smallest balance first — quick wins keep you motivated.',
  avalanche: 'Highest interest rate first — saves the most money.',
};

export default function PayoffPlannerScreen() {
  const theme = useTheme();
  const { format } = useDisplayMoney();
  const [extraInput, setExtraInput] = useState('');
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalanche');

  const { data: loanList } = useLiveQuery(
    db.query.loans.findMany({ with: { payments: true } })
  );
  const openLoans = useMemo(
    () => loanList.filter((loan) => isOpenStatus(loan.status)),
    [loanList]
  );

  const extraCents = toCents(extraInput);
  const comparison = useMemo(
    () => comparePayoffStrategies(openLoans, extraCents),
    [openLoans, extraCents]
  );
  const selected = comparison[strategy];
  const hasExtra = extraCents > 0;

  const chartLines = useMemo<LoanBalanceLine[]>(() => {
    if (!hasExtra || comparison.baseline.balancePoints.length < 2) return [];
    // Both lines must share the baseline's month range; the faster plan flattens at zero.
    const toLine = (plan: PayoffPlan, loanId: number, name: string, color: string): LoanBalanceLine => ({
      loanId,
      name,
      color,
      endDate: plan.debtFreeMonth ?? new Date(),
      points: comparison.baseline.balancePoints.map((basePoint, index) => ({
        month: basePoint.month,
        balanceCents: plan.balancePoints[index]?.balanceCents ?? 0,
        projected: true,
      })),
    });
    return [
      toLine(comparison.baseline, -1, 'Current plan', '#8A968E'),
      toLine(selected, -2, 'With extra', '#12805C'),
    ];
  }, [comparison, selected, hasExtra]);

  function selectStrategy(next: PayoffStrategy) {
    if (next === strategy) return;
    Haptics.selectionAsync();
    setStrategy(next);
  }

  if (openLoans.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.emptyState}>
            <ThemedText themeColor="textSecondary">No open loans to plan for.</ThemedText>
            <ThemedText themeColor="textSecondary">You&apos;re either debt-free or close to it. 🎉</ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#14855F', '#0B5D42']}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.heroCard}>
            <ThemedText type="small" style={styles.heroLabel}>
              {hasExtra ? 'Projected debt-free' : 'Debt-free on the current plan'}
            </ThemedText>
            <ThemedText type="display" style={styles.heroValue}>
              {selected.debtFreeMonth ? monthLabel(selected.debtFreeMonth) : '—'}
            </ThemedText>
            {hasExtra && (
              <ThemedText type="smallBold" style={styles.heroSub}>
                {selected.monthsSaved > 0
                  ? `${selected.monthsSaved} month${selected.monthsSaved === 1 ? '' : 's'} sooner · ${format(selected.interestSavedCents)} interest saved`
                  : 'Add a bit more to start cutting months off.'}
              </ThemedText>
            )}
          </LinearGradient>

          <View style={styles.fieldBlock}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Extra payment per month ({BASE_CURRENCY})
            </ThemedText>
            <TextInput
              value={extraInput}
              onChangeText={setExtraInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
              ]}
            />
            <View style={styles.chipRow}>
              {QUICK_AMOUNTS.map((amount) => (
                <Pressable key={amount} onPress={() => setExtraInput(String(amount))}>
                  <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold">₱{amount.toLocaleString('en-PH')}</ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
            <SegmentButton
              label="Avalanche"
              selected={strategy === 'avalanche'}
              onPress={() => selectStrategy('avalanche')}
            />
            <SegmentButton
              label="Snowball"
              selected={strategy === 'snowball'}
              onPress={() => selectStrategy('snowball')}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {strategyBlurb[strategy]}
          </ThemedText>

          {chartLines.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ThemedText type="smallBold" style={styles.cardTitle}>
                Balance projection
              </ThemedText>
              <BalanceChart lines={chartLines} />
            </View>
          )}

          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <ThemedText type="smallBold" style={styles.cardTitle}>
              Compare plans
            </ThemedText>
            <ComparisonRow label="Minimum payments" plan={comparison.baseline} format={format} />
            <ComparisonRow
              label="Avalanche"
              plan={comparison.avalanche}
              format={format}
              highlighted={strategy === 'avalanche' && hasExtra}
            />
            <ComparisonRow
              label="Snowball"
              plan={comparison.snowball}
              format={format}
              highlighted={strategy === 'snowball' && hasExtra}
            />
          </View>

          {selected.loanPayoffs.length > 0 && (
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <ThemedText type="smallBold" style={styles.cardTitle}>
                Payoff order
              </ThemedText>
              {selected.loanPayoffs.map((payoff, index) => (
                <View key={payoff.loanId} style={styles.payoffRow}>
                  <View style={[styles.payoffIndex, { backgroundColor: theme.primaryTint }]}>
                    <ThemedText type="smallBold" style={{ color: theme.primaryDark }}>
                      {index + 1}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.payoffName}>
                    {payoff.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {monthLabel(payoff.payoffMonth)}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          <ThemedText type="small" themeColor="textMuted">
            Assumes every scheduled month is paid on time and the extra goes straight to
            principal, knocking months off the end of each loan — the same way extra payments
            work when you log them.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ComparisonRow({
  label,
  plan,
  format,
  highlighted,
}: {
  label: string;
  plan: PayoffPlan;
  format: (cents: number) => string;
  highlighted?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.comparisonRow, highlighted && { backgroundColor: theme.primaryTint }]}>
      <View style={styles.comparisonLeading}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {plan.debtFreeMonth ? monthLabel(plan.debtFreeMonth) : '—'}
        </ThemedText>
      </View>
      <View style={styles.comparisonTrailing}>
        <ThemedText type="smallBold" numeric>
          {format(plan.interestPaidCents)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          interest left
        </ThemedText>
      </View>
    </View>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable style={styles.segmentButton} onPress={onPress}>
      <View
        style={[
          styles.segmentInner,
          selected && {
            backgroundColor: theme.card,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          },
        ]}>
        <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
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
    padding: Spacing.three,
    gap: Spacing.three - 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.four,
  },
  heroCard: {
    borderRadius: Radii.card,
    padding: Spacing.three + 2,
    gap: Spacing.one,
    shadowColor: '#0B5D42',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.75)',
  },
  heroValue: {
    color: '#FFFFFF',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.9)',
  },
  fieldBlock: {
    gap: Spacing.one + 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three - 1,
    height: 50,
    fontSize: 17,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  chip: {
    paddingHorizontal: Spacing.three - 1,
    paddingVertical: Spacing.two,
    borderRadius: Radii.row - 6,
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.one + 2,
    padding: Spacing.one,
    borderRadius: Radii.input,
    marginTop: Spacing.one,
  },
  segmentButton: {
    flex: 1,
  },
  segmentInner: {
    borderRadius: Radii.input - 4,
    paddingVertical: Spacing.two + 1,
    alignItems: 'center',
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
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radii.row - 4,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two + 2,
  },
  comparisonLeading: {
    gap: 1,
  },
  comparisonTrailing: {
    alignItems: 'flex-end',
    gap: 1,
  },
  payoffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  payoffIndex: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoffName: {
    flex: 1,
  },
});
