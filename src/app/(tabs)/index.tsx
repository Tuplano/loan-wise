import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      with: { category: true },
      orderBy: (fields, { asc }) => [asc(fields.nextDueDate)],
    })
  );

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

          {loans.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText themeColor="textSecondary">No loans yet.</ThemedText>
              <ThemedText themeColor="textSecondary">Tap + to add your first one.</ThemedText>
            </View>
          ) : (
            <FlatList
              data={loans}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
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
          )}
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
