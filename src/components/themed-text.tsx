import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ManropeFamily, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'title'
    | 'subtitle'
    | 'sectionLabel'
    | 'small'
    | 'smallBold'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
  /** Tabular figures, for money/percent values that should align in a column. */
  numeric?: boolean;
};

export function ThemedText({
  style,
  type = 'default',
  themeColor,
  numeric,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles.base,
        type === 'display' && styles.display,
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'sectionLabel' && styles.sectionLabel,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'link' && styles.link,
        type === 'linkPrimary' && [styles.linkPrimary, { color: theme.primary }],
        type === 'code' && styles.code,
        numeric && styles.numeric,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: ManropeFamily[500],
    fontSize: 16,
    lineHeight: 22,
    color: undefined,
  },
  numeric: {
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  display: {
    fontFamily: ManropeFamily[800],
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: ManropeFamily[800],
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: ManropeFamily[800],
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  sectionLabel: {
    fontFamily: ManropeFamily[700],
    fontSize: 13,
    lineHeight: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  small: {
    fontFamily: ManropeFamily[500],
    fontSize: 13,
    lineHeight: 18,
  },
  smallBold: {
    fontFamily: ManropeFamily[700],
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    fontFamily: ManropeFamily[600],
    lineHeight: 22,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: ManropeFamily[700],
    lineHeight: 22,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts?.mono,
    fontSize: 12,
  },
});
