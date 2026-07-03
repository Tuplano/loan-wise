import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';

import type { CategorySlice } from '@/lib/analytics';

type CategoryBarsProps = {
  slices: CategorySlice[];
};

export function CategoryBars({ slices }: CategoryBarsProps) {
  const theme = useTheme();
  const { format } = useDisplayMoney();
  const maxTotal = Math.max(...slices.map((slice) => slice.paidCents + slice.owedCents), 1);

  return (
    <View style={styles.container}>
      {slices.map((slice) => {
        const total = slice.paidCents + slice.owedCents;
        const paidWidth = `${(slice.paidCents / maxTotal) * 100}%` as `${number}%`;
        const owedWidth = `${(slice.owedCents / maxTotal) * 100}%` as `${number}%`;
        const color = slice.color ?? theme.textMuted;

        return (
          <View key={slice.key} style={styles.row}>
            <View style={styles.labelRow}>
              <View style={styles.nameGroup}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
                  {slice.name}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" numeric>
                {format(total)}
              </ThemedText>
            </View>
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.fill, { width: paidWidth, backgroundColor: color }]} />
              <View
                style={[
                  styles.fill,
                  { width: owedWidth, backgroundColor: theme.divider, borderColor: color, borderLeftWidth: slice.paidCents > 0 ? 1 : 0 },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three - 2,
  },
  row: {
    gap: Spacing.one + 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 1,
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  name: {
    flexShrink: 1,
  },
  track: {
    flexDirection: 'row',
    height: 10,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
