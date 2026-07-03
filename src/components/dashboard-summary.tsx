import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { ProgressBar } from '@/components/ui/progress-bar';
import { Radii, Spacing } from '@/constants/theme';
import { useDisplayMoney } from '@/hooks/use-display-money';

type DashboardSummaryProps = {
  totalBalanceCents: number;
  paidBalanceCents: number;
  activeCount: number;
};

export function DashboardSummary({
  totalBalanceCents,
  paidBalanceCents,
  activeCount,
}: DashboardSummaryProps) {
  const { format } = useDisplayMoney();
  const outstandingCents = Math.max(totalBalanceCents - paidBalanceCents, 0);
  const progress = totalBalanceCents > 0 ? paidBalanceCents / totalBalanceCents : 0;

  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <LinearGradient
        colors={['#14855F', '#0B5D42']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.card}>
        <View style={styles.blob} pointerEvents="none" />

        <ThemedText type="small" style={styles.labelText}>
          Total outstanding balance
        </ThemedText>
        <ThemedText type="display" numeric style={styles.balanceText}>
          {format(outstandingCents)}
        </ThemedText>
        <ThemedText type="small" style={[styles.labelText, styles.subLabel]}>
          {activeCount === 1 ? 'across 1 active loan' : `across ${activeCount} active loans`}
        </ThemedText>

        <ProgressBar
          progress={progress}
          height={8}
          trackColor="rgba(255,255,255,0.22)"
          fillColor="#8FE9BE"
        />

        <View style={styles.footerRow}>
          <ThemedText type="smallBold" numeric style={styles.footerPaid}>
            {format(paidBalanceCents)} paid
          </ThemedText>
          <ThemedText type="smallBold" numeric style={styles.footerTotal}>
            of {format(totalBalanceCents)}
          </ThemedText>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.hero,
    padding: Spacing.four - 2,
    overflow: 'hidden',
    shadowColor: '#0B5D42',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  blob: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  labelText: {
    color: 'rgba(255,255,255,0.75)',
  },
  subLabel: {
    marginBottom: Spacing.three - 2,
  },
  balanceText: {
    color: '#FFFFFF',
    marginTop: Spacing.half,
    marginBottom: Spacing.half,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two + 2,
  },
  footerPaid: {
    color: 'rgba(255,255,255,0.9)',
  },
  footerTotal: {
    color: 'rgba(255,255,255,0.6)',
  },
});
