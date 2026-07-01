import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/format';

type DashboardSummaryProps = {
  principalBalanceCents: number;
  totalPaidCents: number;
  monthlyDueCents: number;
  activeCount: number;
};

export function DashboardSummary({
  principalBalanceCents,
  totalPaidCents,
  monthlyDueCents,
  activeCount,
}: DashboardSummaryProps) {
  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        Principal balance
      </ThemedText>
      <ThemedText type="title" style={styles.headline}>
        {formatMoney(principalBalanceCents)}
      </ThemedText>

      <View style={styles.row}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Total paid
          </ThemedText>
          <ThemedText>{formatMoney(totalPaidCents)}</ThemedText>
        </View>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Due this month
          </ThemedText>
          <ThemedText>{formatMoney(monthlyDueCents)}</ThemedText>
        </View>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Active loans
          </ThemedText>
          <ThemedText>{activeCount}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.one,
  },
  headline: {
    fontSize: 40,
    lineHeight: 44,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.five,
    paddingTop: Spacing.three,
  },
});
