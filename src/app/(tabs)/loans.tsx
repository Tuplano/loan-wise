import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoanRow } from '@/components/loan-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { loans } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { cancelReminder } from '@/lib/notifications';

export default function LoansScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { data: loanList } = useLiveQuery(
    db.query.loans.findMany({
      with: { category: true, reminders: true },
      orderBy: (fields, { asc }) => [asc(fields.nextDueDate)],
    })
  );

  function handleDelete(id: number, name: string, notificationId: string | null) {
    Alert.alert('Delete loan', `Delete "${name}"? This also removes its payment history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (notificationId) await cancelReminder(notificationId);
          await db.delete(loans).where(eq(loans.id, id));
        },
      },
    ]);
  }

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
            data={loanList}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
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
                onDelete={() =>
                  handleDelete(item.id, item.name, item.reminders[0]?.notificationId ?? null)
                }
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
