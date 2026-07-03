import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalanceChart } from '@/components/charts/balance-chart';
import { CategoryBars } from '@/components/charts/category-bars';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ProgressRing } from '@/components/ui/progress-ring';
import { BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';
import {
  buildPerLoanBalanceTimelines,
  categoryBreakdown,
  interestSplit,
  projectedDebtFreeDate,
} from '@/lib/analytics';
import { formatDate } from '@/lib/date';

type FilterMode = 'category' | 'loan';

export default function InsightsScreen() {
  const theme = useTheme();
  const { format } = useDisplayMoney();
  const [filterMode, setFilterMode] = useState<FilterMode>('category');
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [loanFilter, setLoanFilter] = useState<number | 'all'>('all');

  const { data: loans } = useLiveQuery(
    db.query.loans.findMany({ with: { payments: true, category: true, transactions: true } })
  );
  const { data: categoryList } = useLiveQuery(db.query.categories.findMany());

  const filteredLoans = useMemo(() => {
    if (filterMode === 'category' && categoryFilter !== 'all') {
      return loans.filter((loan) => loan.categoryId === categoryFilter);
    }
    if (filterMode === 'loan' && loanFilter !== 'all') {
      return loans.filter((loan) => loan.id === loanFilter);
    }
    return loans;
  }, [loans, filterMode, categoryFilter, loanFilter]);

  const balanceLines = useMemo(() => buildPerLoanBalanceTimelines(filteredLoans), [filteredLoans]);
  const debtFreeDate = useMemo(() => projectedDebtFreeDate(filteredLoans), [filteredLoans]);
  const allPayments = useMemo(() => filteredLoans.flatMap((loan) => loan.payments), [filteredLoans]);
  const allTransactions = useMemo(
    () => filteredLoans.flatMap((loan) => loan.transactions),
    [filteredLoans]
  );
  const interest = useMemo(
    () => interestSplit(allPayments, allTransactions),
    [allPayments, allTransactions]
  );
  const categories = useMemo(() => categoryBreakdown(filteredLoans), [filteredLoans]);

  const totalPrincipalCents = filteredLoans.reduce((sum, loan) => sum + loan.principalCents, 0);
  const paidPrincipalCents = allTransactions.reduce(
    (sum, transaction) => sum + transaction.principalAppliedCents,
    0
  );
  const overallProgress = totalPrincipalCents > 0 ? paidPrincipalCents / totalPrincipalCents : 0;
  const remainingPrincipalCents = Math.max(totalPrincipalCents - paidPrincipalCents, 0);
  const totalInterestCents = interest.paidCents + interest.remainingCents;

  function selectMode(mode: FilterMode) {
    if (mode === filterMode) return;
    Haptics.selectionAsync();
    setFilterMode(mode);
  }

  function selectCategory(id: number | 'all') {
    Haptics.selectionAsync();
    setCategoryFilter(id);
  }

  function selectLoan(id: number | 'all') {
    Haptics.selectionAsync();
    setLoanFilter(id);
  }

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

          <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
            <SegmentButton
              label="By category"
              selected={filterMode === 'category'}
              onPress={() => selectMode('category')}
            />
            <SegmentButton label="By loan" selected={filterMode === 'loan'} onPress={() => selectMode('loan')} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {filterMode === 'category' ? (
              <>
                <FilterChip label="All" selected={categoryFilter === 'all'} onPress={() => selectCategory('all')} />
                {categoryList.map((category) => (
                  <FilterChip
                    key={category.id}
                    label={category.name}
                    color={category.color}
                    selected={categoryFilter === category.id}
                    onPress={() => selectCategory(category.id)}
                  />
                ))}
              </>
            ) : (
              <>
                <FilterChip label="All" selected={loanFilter === 'all'} onPress={() => selectLoan('all')} />
                {loans.map((loan) => (
                  <FilterChip
                    key={loan.id}
                    label={loan.name}
                    selected={loanFilter === loan.id}
                    onPress={() => selectLoan(loan.id)}
                  />
                ))}
              </>
            )}
          </ScrollView>

          {filteredLoans.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText themeColor="textSecondary">No loans match this filter.</ThemedText>
            </View>
          ) : (
            <>
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
                    {format(paidPrincipalCents)} of {format(totalPrincipalCents)} principal paid
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText type="smallBold" style={styles.cardTitle}>
                  Balance over time
                </ThemedText>
                <BalanceChart lines={balanceLines} />
              </View>

              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText type="smallBold" style={styles.cardTitle}>
                  Principal &amp; interest
                </ThemedText>

                <View style={styles.splitBlock}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Principal
                  </ThemedText>
                  <ProgressBar progress={overallProgress} height={10} />
                  <View style={styles.interestRow}>
                    <View>
                      <ThemedText type="small" themeColor="textSecondary">
                        Paid
                      </ThemedText>
                      <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark }}>
                        {format(paidPrincipalCents)}
                      </ThemedText>
                    </View>
                    <View style={styles.interestRight}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Remaining
                      </ThemedText>
                      <ThemedText type="smallBold" numeric themeColor="danger">
                        {format(remainingPrincipalCents)}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <View style={[styles.splitBlock, styles.splitBlockDivider, { borderTopColor: theme.divider }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Interest
                  </ThemedText>
                  <ProgressBar
                    progress={totalInterestCents > 0 ? interest.paidCents / totalInterestCents : 0}
                    height={10}
                  />
                  <View style={styles.interestRow}>
                    <View>
                      <ThemedText type="small" themeColor="textSecondary">
                        Paid
                      </ThemedText>
                      <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark }}>
                        {format(interest.paidCents)}
                      </ThemedText>
                    </View>
                    <View style={styles.interestRight}>
                      <ThemedText type="small" themeColor="textSecondary">
                        Remaining
                      </ThemedText>
                      <ThemedText type="smallBold" numeric themeColor="danger">
                        {format(interest.remainingCents)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText type="smallBold" style={styles.cardTitle}>
                  By category
                </ThemedText>
                <CategoryBars slices={categories} />
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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

function FilterChip({
  label,
  color,
  selected,
  onPress,
}: {
  label: string;
  color?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.chip,
          selected
            ? { backgroundColor: theme.primary }
            : { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        ]}>
        {color && !selected && <View style={[styles.chipDot, { backgroundColor: color }]} />}
        <ThemedText type="smallBold" numberOfLines={1} style={selected ? styles.chipTextSelected : undefined}>
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
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three - 2,
  },
  header: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.one + 2,
    padding: Spacing.one,
    borderRadius: Radii.input,
    marginBottom: Spacing.two,
  },
  segmentButton: {
    flex: 1,
  },
  segmentInner: {
    borderRadius: Radii.input - 4,
    paddingVertical: Spacing.two + 1,
    alignItems: 'center',
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three - 1,
    paddingVertical: Spacing.two,
    borderRadius: Radii.pill,
    marginRight: Spacing.two,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  splitBlock: {
    gap: Spacing.two,
  },
  splitBlockDivider: {
    paddingTop: Spacing.two + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  interestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  interestRight: {
    alignItems: 'flex-end',
  },
});
