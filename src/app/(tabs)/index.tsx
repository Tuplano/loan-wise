import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardSummary } from '@/components/dashboard-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';

export default function DashboardScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data: loans } = useLiveQuery(db.query.loans.findMany({ with: { payments: true } }));
  const { data: recentPayments } = useLiveQuery(
    db.query.payments.findMany({
      with: { loan: true },
      orderBy: (fields, { desc }) => [desc(fields.paidAt)],
      limit: 5,
    })
  );

  const principalBalanceCents = loans.reduce((sum, loan) => {
    const principalPaid = loan.payments.reduce(
      (paid, payment) => paid + (payment.principalPortionCents ?? 0),
      0
    );
    return sum + Math.max(loan.principalCents - principalPaid, 0);
  }, 0);

  const totalPaidCents = loans.reduce(
    (sum, loan) => sum + loan.payments.reduce((paid, payment) => paid + payment.amountCents, 0),
    0
  );

  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const monthlyDueCents = activeLoans.reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0);

  const upcoming = [...activeLoans]
    .sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime())
    .slice(0, 5);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Dashboard</ThemedText>
          </View>

          <DashboardSummary
            principalBalanceCents={principalBalanceCents}
            totalPaidCents={totalPaidCents}
            monthlyDueCents={monthlyDueCents}
            activeCount={activeLoans.length}
          />

          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Upcoming
          </ThemedText>
          {upcoming.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyRow}>
              Nothing due right now.
            </ThemedText>
          ) : (
            upcoming.map((loan) => (
              <Pressable
                key={loan.id}
                onPress={() => router.push(`/loan/${loan.id}`)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.rowLeading}>
                  <ThemedText numberOfLines={1}>{loan.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(loan.nextDueDate)}
                  </ThemedText>
                </View>
                <ThemedText>{formatMoney(loan.monthlyPaymentCents)}</ThemedText>
              </Pressable>
            ))
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            Recent activity
          </ThemedText>
          {recentPayments.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyRow}>
              No payments logged yet.
            </ThemedText>
          ) : (
            recentPayments.map((payment) => (
              <Pressable
                key={payment.id}
                onPress={() => router.push(`/loan/${payment.loanId}`)}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.rowLeading}>
                  <ThemedText numberOfLines={1}>{payment.loan.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatDate(payment.paidAt)}
                  </ThemedText>
                </View>
                <ThemedText>{formatMoney(payment.amountCents)}</ThemedText>
              </Pressable>
            ))
          )}
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
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.one,
  },
  emptyRow: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeading: {
    gap: Spacing.half,
    flexShrink: 1,
  },
});
