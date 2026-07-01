import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';

export default function PaymentsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data: paymentList } = useLiveQuery(
    db.query.payments.findMany({
      with: { loan: true },
      orderBy: (fields, { desc }) => [desc(fields.paidAt)],
    })
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Payments</ThemedText>
          </View>

          <FlatList
            data={paymentList}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText themeColor="textSecondary">No payments logged yet.</ThemedText>
                <ThemedText themeColor="textSecondary">
                  Mark a month paid on a loan to see it here.
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/loan/${item.loanId}`)}
                style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
                  <View style={styles.rowLeading}>
                    <ThemedText numberOfLines={1}>{item.loan.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDate(item.paidAt)}
                    </ThemedText>
                  </View>
                  <ThemedText>{formatMoney(item.amountCents)}</ThemedText>
                </View>
              </Pressable>
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeading: {
    gap: Spacing.half,
    flexShrink: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
