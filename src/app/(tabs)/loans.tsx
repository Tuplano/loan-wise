import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Link, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoanRow } from '@/components/loan-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { loans } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { cancelReminder } from '@/lib/notifications';

type FilterKey = 'active' | 'paid' | 'all';

export default function LoansScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('active');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { data: loanList } = useLiveQuery(
    db.query.loans.findMany({
      with: { category: true, reminders: true, payments: true },
      orderBy: (fields, { asc }) => [asc(fields.nextDueDate)],
    })
  );

  const activeCount = loanList.filter((loan) => loan.status === 'active').length;
  const paidCount = loanList.filter((loan) => loan.status === 'paid_off').length;

  const filteredLoans = useMemo(() => {
    const byStatus = loanList.filter((loan) => {
      if (filter === 'active') return loan.status === 'active';
      if (filter === 'paid') return loan.status === 'paid_off';
      return true;
    });
    const q = query.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter(
      (loan) =>
        loan.name.toLowerCase().includes(q) || (loan.lender ?? '').toLowerCase().includes(q)
    );
  }, [loanList, filter, query]);

  function handleDelete(id: number, name: string, notificationId: string | null) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
            <ThemedText type="title">Loans</ThemedText>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => {
                  setSearchOpen((open) => !open);
                  if (searchOpen) setQuery('');
                }}
                style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.iconButton, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <SymbolView
                    tintColor={theme.textSecondary}
                    name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                    size={18}
                  />
                </View>
              </Pressable>
              <Link href="/add-loan" asChild>
                <Pressable style={({ pressed }) => pressed && styles.pressed}>
                  <View style={[styles.iconButton, styles.addButton, { backgroundColor: theme.primary }]}>
                    <SymbolView
                      tintColor="#FFFFFF"
                      name={{ ios: 'plus', android: 'add', web: 'add' }}
                      size={20}
                    />
                  </View>
                </Pressable>
              </Link>
            </View>
          </View>

          {searchOpen && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Search loans"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.searchInput,
                { color: theme.text, backgroundColor: theme.card, borderColor: theme.border },
              ]}
            />
          )}

          <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
            <SegmentButton
              label={`Active · ${activeCount}`}
              selected={filter === 'active'}
              onPress={() => setFilter('active')}
            />
            <SegmentButton
              label={`Paid · ${paidCount}`}
              selected={filter === 'paid'}
              onPress={() => setFilter('paid')}
            />
            <SegmentButton label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
          </View>

          <FlatList
            data={filteredLoans}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.two + 2 }} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText themeColor="textSecondary">No loans here.</ThemedText>
                <ThemedText themeColor="textSecondary">Tap + to add your first one.</ThemedText>
              </View>
            }
            renderItem={({ item, index }) => {
              const principalPaid = item.payments.reduce(
                (paid, payment) => paid + (payment.isPaid ? payment.principalPortionCents : 0),
                0
              );
              const remainingCents = Math.max(item.principalCents - principalPaid, 0);

              return (
                <LoanRow
                  name={item.name}
                  lender={item.lender}
                  categoryName={item.category?.name}
                  categoryColor={item.category?.color}
                  principalCents={item.principalCents}
                  remainingCents={remainingCents}
                  monthlyPaymentCents={item.monthlyPaymentCents}
                  nextDueDate={item.nextDueDate}
                  status={item.status}
                  index={index}
                  onPress={() => router.push(`/loan/${item.id}`)}
                  onDelete={() =>
                    handleDelete(item.id, item.name, item.reminders[0]?.notificationId ?? null)
                  }
                />
              );
            }}
          />
        </View>
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
    <Pressable
      style={styles.segmentButton}
      onPress={() => {
        if (!selected) Haptics.selectionAsync();
        onPress();
      }}>
      <View
        style={[
          styles.segmentInner,
          selected && { backgroundColor: theme.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
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
    paddingHorizontal: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.input - 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    borderWidth: 0,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
    marginBottom: Spacing.two,
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.one + 2,
    padding: Spacing.one,
    borderRadius: Radii.input,
    marginBottom: Spacing.three,
  },
  segmentButton: {
    flex: 1,
  },
  segmentInner: {
    borderRadius: Radii.input - 4,
    paddingVertical: Spacing.two + 1,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.six,
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.three,
  },
});
