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
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';
import { sumPaymentsInMonth } from '@/lib/stats';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const theme = useTheme();
  const currency = useCurrency();
  const router = useRouter();

  const { data: loans } = useLiveQuery(db.query.loans.findMany({ with: { payments: true, category: true } }));
  const { data: allPayments } = useLiveQuery(db.query.payments.findMany());

  const activeLoans = loans.filter((loan) => loan.status === 'active');

  const totalPrincipalCents = activeLoans.reduce((sum, loan) => sum + loan.principalCents, 0);
  const paidPrincipalCents = activeLoans.reduce((sum, loan) => {
    const principalPaid = loan.payments.reduce(
      (paid, payment) => paid + (payment.isPaid ? payment.principalPortionCents : 0),
      0
    );
    return sum + Math.min(principalPaid, loan.principalCents);
  }, 0);

  const monthlyDueCents = activeLoans.reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0);
  const paidThisMonthCents = sumPaymentsInMonth(allPayments);

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
            <ThemedText type="small" themeColor="textSecondary">
              {greeting()}
            </ThemedText>
            <ThemedText type="subtitle">Dashboard</ThemedText>
          </View>

          <DashboardSummary
            totalPrincipalCents={totalPrincipalCents}
            paidPrincipalCents={paidPrincipalCents}
            activeCount={activeLoans.length}
          />

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
              value={formatMoney(monthlyDueCents, currency)}
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
              value={formatMoney(paidThisMonthCents, currency)}
            />
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
                  {formatMoney(nextDue.monthlyPaymentCents, currency)}
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
            <View style={styles.loanList}>
              {activeLoans.map((loan, index) => {
                const principalPaid = loan.payments.reduce(
                  (paid, payment) => paid + (payment.isPaid ? payment.principalPortionCents : 0),
                  0
                );
                const remainingCents = Math.max(loan.principalCents - principalPaid, 0);
                const progress =
                  loan.principalCents > 0 ? Math.min(principalPaid / loan.principalCents, 1) : 0;
                const subtitle =
                  [loan.category?.name, loan.lender].filter(Boolean).join(' · ') || 'Uncategorized';

                return (
                  <ActiveLoanRingRow
                    key={loan.id}
                    name={loan.name}
                    subtitle={subtitle}
                    remainingCents={remainingCents}
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
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.half,
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
  loanList: {
    gap: Spacing.two + 2,
  },
});
