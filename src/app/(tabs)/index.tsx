import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardSummary } from '@/components/dashboard-summary';
import { LoanRow } from '@/components/loan-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useTheme } from '@/hooks/use-theme';

export default function LoansScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: loans } = useLiveQuery(
    db.query.loans.findMany({
      with: { category: true, payments: true },
      orderBy: (fields, { asc }) => [asc(fields.nextDueDate)],
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Loans</ThemedText>
            <Link href="/add-loan" asChild>
              <Pressable style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.addButton}>
                  <SymbolView
                    tintColor={theme.text}
                    name={{ ios: 'plus', android: 'add', web: 'add' }}
                    size={20}
                  />
                </ThemedView>
              </Pressable>
            </Link>
          </View>

          <FlatList
            data={loans}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <DashboardSummary
                principalBalanceCents={principalBalanceCents}
                totalPaidCents={totalPaidCents}
                monthlyDueCents={monthlyDueCents}
                activeCount={activeLoans.length}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText themeColor="textSecondary">No loans yet.</ThemedText>
                <ThemedText themeColor="textSecondary">Tap + to add your first one.</ThemedText>
              </View>
            }
            renderItem={({ item }) => (
              <LoanRow
                name={item.name}
                lender={item.lender}
                categoryName={item.category?.name}
                categoryColor={item.category?.color}
                monthlyPaymentCents={item.monthlyPaymentCents}
                status={item.status}
                onPress={() => router.push(`/loan/${item.id}`)}
              />
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
