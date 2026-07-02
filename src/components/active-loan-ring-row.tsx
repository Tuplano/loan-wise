import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { ProgressRing } from '@/components/ui/progress-ring';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/format';

type ActiveLoanRingRowProps = {
  name: string;
  subtitle: string;
  remainingCents: number;
  progress: number;
  onPress?: () => void;
};

export function ActiveLoanRingRow({
  name,
  subtitle,
  remainingCents,
  progress,
  onPress,
}: ActiveLoanRingRowProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ProgressRing progress={progress} size={46} strokeWidth={5}>
          <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark, fontSize: 12 }}>
            {Math.round(progress * 100)}%
          </ThemedText>
        </ProgressRing>

        <View style={styles.leading}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
            {name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </View>

        <View style={styles.trailing}>
          <ThemedText type="smallBold" numeric style={styles.name}>
            {formatMoney(remainingCents)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            remaining
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    borderWidth: 1,
    borderRadius: Radii.row,
    padding: Spacing.three - 2,
  },
  name: {
    fontSize: 15,
  },
  leading: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 1,
  },
});
