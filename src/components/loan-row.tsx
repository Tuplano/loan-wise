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
}: LoanRowProps) {
  const theme = useTheme();
  const subtitle = [categoryName, lender].filter(Boolean).join(' · ') || 'Uncategorized';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}>
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
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
