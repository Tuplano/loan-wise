import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { PillBadge } from '@/components/ui/pill-badge';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Radii, Spacing } from '@/constants/theme';
import type { LoanStatus } from '@/db/schema';
import { useCurrency } from '@/hooks/use-currency';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/date';
import { formatMoney } from '@/lib/format';

type LoanRowProps = {
  name: string;
  lender?: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  principalCents: number;
  remainingCents: number;
  monthlyPaymentCents: number;
  nextDueDate: Date;
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
  principalCents,
  remainingCents,
  monthlyPaymentCents,
  nextDueDate,
  status,
  onPress,
  onDelete,
}: LoanRowProps) {
  const theme = useTheme();
  const currency = useCurrency();
  const progress = principalCents > 0 ? 1 - remainingCents / principalCents : 0;
  const daysUntilDue = (nextDueDate.getTime() - Date.now()) / 86_400_000;
  const isOverdue = status === 'active' && daysUntilDue < 0;
  const isDueSoon = status === 'active' && !isOverdue && daysUntilDue <= 5;

  return (
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
            {formatMoney(remainingCents, currency)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numeric>
            of {formatMoney(principalCents, currency)}
          </ThemedText>
        </View>

        <ProgressBar progress={progress} />

        <View style={[styles.footer, { borderTopColor: theme.divider }]}>
          <View>
            <ThemedText type="small" themeColor="textSecondary">
              Monthly
            </ThemedText>
            <ThemedText type="smallBold" numeric>
              {formatMoney(monthlyPaymentCents, currency)}
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
