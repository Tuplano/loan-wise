import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { PillBadge } from '@/components/ui/pill-badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Radii, Spacing } from '@/constants/theme';
import type { LoanStatus } from '@/db/schema';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';

type LoanRowProps = {
  name: string;
  lender?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  principalCents: number;
  totalPaidCents: number;
  totalRemainingCents: number;
  principalPaidCents: number;
  monthlyPaymentCents: number;
  nextDueDate: Date;
  status: LoanStatus;
  index?: number;
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
  principalCents,
  totalPaidCents,
  totalRemainingCents,
  principalPaidCents,
  monthlyPaymentCents,
  nextDueDate,
  status,
  index = 0,
  onPress,
  onDelete,
}: LoanRowProps) {
  const theme = useTheme();
  const { format } = useDisplayMoney();
  const progress = principalCents > 0 ? principalPaidCents / principalCents : 0;
  const [renderedAt] = useState(() => Date.now());
  const daysUntilDue = (nextDueDate.getTime() - renderedAt) / 86_400_000;
  const isOverdue = status === 'overdue';
  const isDueSoon = status === 'active' && daysUntilDue <= 5;

  return (
    <Animated.View entering={FadeIn.duration(280).delay(Math.min(index * 40, 200))}>
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.topRow}>
            <View style={styles.titleGroup}>
              <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
                {name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {lender || 'No lender set'}
              </ThemedText>
            </View>
            {isOverdue && <PillBadge label="Overdue" tone="danger" />}
            {categoryName ? (
              <PillBadge label={categoryName} color={categoryColor ?? undefined} />
            ) : (
              <PillBadge label={statusLabel[status]} tone="neutral" />
            )}
            {onDelete && (
              <Pressable hitSlop={8} onPress={onDelete} style={styles.deleteButton}>
                <SymbolView
                  tintColor={theme.textSecondary}
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  size={16}
                />
              </Pressable>
            )}
          </View>

          <View style={styles.amountRow}>
            <ThemedText type="subtitle" numeric>
              {format(totalPaidCents)}
            </ThemedText>
            <View style={styles.amountMeta}>
              <ThemedText type="small" themeColor="textSecondary" numeric>
                {format(totalRemainingCents)} remaining
              </ThemedText>
            </View>
          </View>

          <ProgressBar progress={progress} />

          <View style={[styles.footer, { borderTopColor: theme.divider }]}>
            <View>
              <ThemedText type="small" themeColor="textSecondary">
                Monthly
              </ThemedText>
              <ThemedText type="smallBold" numeric>
                {format(monthlyPaymentCents)}
              </ThemedText>
            </View>
            <View style={styles.footerRight}>
              <ThemedText type="small" themeColor="textSecondary">
                {status === 'paid_off' ? 'Status' : isOverdue ? 'Overdue' : 'Next due'}
              </ThemedText>
              <ThemedText
                type="smallBold"
                style={isOverdue || isDueSoon ? { color: theme.danger } : undefined}>
                {status === 'paid_off'
                  ? 'Paid off'
                  : isOverdue
                    ? `${formatDate(nextDueDate)} · ${Math.abs(Math.floor(daysUntilDue))}d late`
                    : formatDate(nextDueDate)}
              </ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three,
    gap: Spacing.two + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  name: {
    fontSize: 16,
  },
  deleteButton: {
    padding: Spacing.half,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  amountMeta: {
    alignItems: 'flex-end',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.two + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
});
