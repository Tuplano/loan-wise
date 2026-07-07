import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveLoanRingRow } from '@/components/active-loan-ring-row';
import { DashboardSummary } from '@/components/dashboard-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PillBadge } from '@/components/ui/pill-badge';
import { PrimaryButton } from '@/components/ui/primary-button';
import { BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';
import { buildDashboardBalanceSummary } from '@/lib/loans/dashboard-balance';
import { addMonths, formatDate } from '@/lib/date';
import { buildLoanSummary } from '@/lib/loans/loan-summary';
import { isOpenStatus } from '@/lib/loans/loan-status';
import { remainingDueCents } from '@/lib/loans/schedule';
import { isSameMonth, sumTransactionsInMonth } from '@/lib/loans/stats';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { format } = useDisplayMoney();
  const router = useRouter();

  const { data: loans } = useLiveQuery(
    db.query.loans.findMany({ with: { payments: true, category: true, transactions: true } })
  );

  const activeLoans = loans.filter((loan) => isOpenStatus(loan.status));
  const overdueLoans = loans.filter((loan) => loan.status === 'overdue');
  const overdueTotalCents = overdueLoans.reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0);

  const activeLoanSummaries = activeLoans.map((loan) =>
    buildLoanSummary({
      principalCents: loan.principalCents,
      monthlyPaymentCents: loan.monthlyPaymentCents,
      termMonths: loan.termMonths,
      payments: loan.payments,
      transactions: loan.transactions,
    })
  );
  const dashboardBalance = buildDashboardBalanceSummary(activeLoans);

  const now = new Date();
  const nextMonth = addMonths(now, 1);
  const monthlyDueCents = activeLoans
    .flatMap((loan) => loan.payments)
    .filter((payment) => !payment.isPaid && isSameMonth(payment.dueDate, now))
    .reduce((sum, payment) => sum + remainingDueCents(payment), 0);
  const dueNextMonthCents = activeLoans
    .flatMap((loan) => loan.payments)
    .filter((payment) => !payment.isPaid && isSameMonth(payment.dueDate, nextMonth))
    .reduce((sum, payment) => sum + remainingDueCents(payment), 0);
  const paidThisMonthCents = sumTransactionsInMonth(loans.flatMap((loan) => loan.transactions));

  const upcoming = [...activeLoans].sort(
    (a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime()
  );
  const nextDue = upcoming[0];
  const daysUntilDue = nextDue
    ? Math.ceil((nextDue.nextDueDate.getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                {greeting()}
              </ThemedText>
              <ThemedText type="subtitle">Dashboard</ThemedText>
            </View>
            <Pressable
              onPress={() => router.push('/calendar')}
              style={({ pressed }) => pressed && styles.pressed}>
              <View style={[styles.iconButton, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <SymbolView
                  tintColor={theme.textSecondary}
                  name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
                  size={18}
                />
              </View>
            </Pressable>
          </View>

          <DashboardSummary
            totalBalanceCents={dashboardBalance.totalBalanceCents}
            paidBalanceCents={dashboardBalance.paidBalanceCents}
            activeCount={activeLoans.length}
          />

          {overdueLoans.length > 0 && (
            <Pressable
              onPress={() => router.push('/loans')}
              style={({ pressed }) => pressed && styles.pressed}>
              <View style={[styles.overdueCard, { backgroundColor: theme.dangerTint, borderColor: theme.danger }]}>
                <View style={[styles.overdueIcon, { backgroundColor: theme.danger }]}>
                  <SymbolView
                    tintColor="#FFFFFF"
                    name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                    size={16}
                  />
                </View>
                <View style={styles.overdueTextGroup}>
                  <ThemedText type="smallBold" style={{ color: theme.danger }}>
                    {overdueLoans.length === 1 ? '1 loan is overdue' : `${overdueLoans.length} loans are overdue`}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {format(overdueTotalCents)} past due
                  </ThemedText>
                </View>
                <SymbolView
                  tintColor={theme.danger}
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={16}
                />
              </View>
            </Pressable>
          )}

          <View style={styles.statsRow}>
            <StatCard
              icon={
                <SymbolView
                  tintColor={theme.danger}
                  name={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
                  size={15}
                />
              }
              iconBg={theme.dangerTint}
              label="Due this month"
              value={format(monthlyDueCents)}
            />
            <StatCard
              icon={
                <SymbolView
                  tintColor={theme.primary}
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  size={15}
                />
              }
              iconBg={theme.primaryTint}
              label="Paid this month"
              value={format(paidThisMonthCents)}
            />
          </View>

          <View style={[styles.wideStatCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.statIcon, { backgroundColor: theme.primaryTint, marginBottom: 0 }]}>
              <SymbolView
                tintColor={theme.primary}
                name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
                size={15}
              />
            </View>
            <View style={styles.wideStatTextGroup}>
              <ThemedText type="small" themeColor="textSecondary">
                Due next month
              </ThemedText>
              <ThemedText
                type="smallBold"
                numeric
                style={[styles.wideStatValue, { color: theme.primaryDark }]}>
                {format(dueNextMonthCents)}
              </ThemedText>
            </View>
          </View>

          {nextDue && (
            <View style={[styles.nextDueCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.nextDueHeader}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Next payment due
                </ThemedText>
                {daysUntilDue !== null && (
                  <PillBadge
                    label={
                      daysUntilDue < 0
                        ? `${Math.abs(daysUntilDue)}d overdue`
                        : daysUntilDue === 0
                          ? 'due today'
                          : daysUntilDue === 1
                            ? 'in 1 day'
                            : `in ${daysUntilDue} days`
                    }
                    tone={daysUntilDue <= 3 ? 'danger' : 'primary'}
                  />
                )}
              </View>
              <View style={styles.nextDueRow}>
                <View style={styles.nextDueLeading}>
                  <ThemedText type="smallBold" style={styles.nextDueName}>
                    {nextDue.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Due {formatDate(nextDue.nextDueDate)}
                  </ThemedText>
                </View>
                <ThemedText type="subtitle" numeric style={{ color: theme.primaryDark }}>
                  {format(nextDue.monthlyPaymentCents)}
                </ThemedText>
              </View>
              <PrimaryButton label="Log payment" onPress={() => router.push(`/loan/${nextDue.id}`)} />
            </View>
          )}

          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Active loans
            </ThemedText>
            <Pressable onPress={() => router.push('/loans')}>
              <ThemedText type="linkPrimary">See all</ThemedText>
            </Pressable>
          </View>

          {activeLoans.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyRow}>
              No active loans. Tap Loans to add one.
            </ThemedText>
          ) : (
            <View>
              {activeLoans.map((loan, index) => {
                const summary = activeLoanSummaries[index];
                const principalPaid = loan.transactions.reduce(
                  (paid, transaction) => paid + transaction.principalAppliedCents,
                  0
                );
                const progress =
                  loan.principalCents > 0 ? Math.min(principalPaid / loan.principalCents, 1) : 0;
                const subtitle =
                  [loan.category?.name, loan.lender].filter(Boolean).join(' · ') || 'Uncategorized';

                return (
                  <ActiveLoanRingRow
                    key={loan.id}
                    name={loan.name}
                    subtitle={subtitle}
                    remainingCents={summary.totalRemainingCents}
                    progress={progress}
                    index={index}
                    onPress={() => router.push(`/loan/${loan.id}`)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numeric style={styles.statValue}>
        {value}
      </ThemedText>
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
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three - 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.75,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.input - 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: Radii.row,
    padding: Spacing.three - 2,
  },
  overdueIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueTextGroup: {
    flex: 1,
    gap: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.row + 2,
    padding: Spacing.three - 1,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  statValue: {
    fontSize: 18,
    marginTop: 2,
  },
  wideStatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: Radii.row + 2,
    padding: Spacing.three - 1,
  },
  wideStatTextGroup: {
    flex: 1,
    gap: 1,
  },
  wideStatValue: {
    fontSize: 18,
  },
  nextDueCard: {
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three + 2,
    gap: Spacing.three - 2,
  },
  nextDueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextDueLeading: {
    gap: 2,
  },
  nextDueName: {
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
  },
  emptyRow: {
    paddingVertical: Spacing.two,
  },
});
