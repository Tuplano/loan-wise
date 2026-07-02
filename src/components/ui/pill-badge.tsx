import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function withAlpha(hex: string, alpha: string) {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex;
}

type PillBadgeProps = {
  label: string;
  /** Arbitrary hex color (e.g. a category color) — background is a tint of it. */
  color?: string;
  /** Named tone using theme tokens, used when there's no arbitrary color (e.g. status pills). */
  tone?: 'primary' | 'danger' | 'neutral';
};

export function PillBadge({ label, color, tone = 'primary' }: PillBadgeProps) {
  const theme = useTheme();

  const textColor = color ?? (tone === 'danger' ? theme.danger : tone === 'neutral' ? theme.textSecondary : theme.primaryDark);
  const backgroundColor = color
    ? withAlpha(color, '26')
    : tone === 'danger'
      ? theme.dangerTint
      : tone === 'neutral'
        ? theme.backgroundElement
        : theme.primaryTint;

  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <ThemedText type="smallBold" style={{ color: textColor }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.half + 2,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
});
