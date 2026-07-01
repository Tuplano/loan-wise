import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import type { LoanStatus } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

type LoanRowProps = {
  name: string;
  lender?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  monthlyPaymentCents: number;
  status: LoanStatus;
  onPress?: () => void;
  onDelete?: () => void;
};

const statusLabel: Record<LoanStatus, string> = {
  active: 'Active',
  paid_off: 'Paid off',
  overdue: 'Overdue',
};

export function LoanRow({
  name,
  lender,
  categoryName,
  categoryColor,
  monthlyPaymentCents,
  status,
  onPress,
  onDelete,
}: LoanRowProps) {
  const theme = useTheme();
  const subtitle = [categoryName, lender].filter(Boolean).join(' · ') || 'Uncategorized';

  return (
    <ThemedView style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowContent, pressed && styles.pressed]}>
        <View style={styles.leading}>
          <ThemedText numberOfLines={1}>{name}</ThemedText>
          <View style={styles.metaRow}>
            {categoryColor && <View style={[styles.dot, { backgroundColor: categoryColor }]} />}
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          </View>
        </View>
        <View style={styles.trailing}>
          <ThemedText>{formatMoney(monthlyPaymentCents)}/mo</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {statusLabel[status]}
          </ThemedText>
        </View>
      </Pressable>
      {onDelete && (
        <Pressable
          hitSlop={8}
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
          <SymbolView
            tintColor={theme.textSecondary}
            name={{ ios: 'trash', android: 'delete', web: 'delete' }}
            size={18}
          />
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.three,
  },
  deleteButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  leading: {
    gap: Spacing.half,
    flexShrink: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
