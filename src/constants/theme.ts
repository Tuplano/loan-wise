/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * For font/typography rationale see components/themed-text.tsx.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#16211C',
    textSecondary: '#7C8A81',
    textMuted: '#8A968E',
    background: '#F3F6F2',
    card: '#FFFFFF',
    backgroundElement: '#E8EDE8',
    backgroundSelected: '#DCE7E0',
    border: '#EAEFEA',
    divider: '#F0F3F0',
    primary: '#12805C',
    primaryDark: '#0B5D42',
    primaryLight: '#14855F',
    primaryTint: '#E6F1EB',
    danger: '#C0553B',
    dangerTint: '#FDEDE7',
    success: '#12805C',
    successTint: '#E6F1EB',
  },
  dark: {
    text: '#EAF2EC',
    textSecondary: '#9BAAA1',
    textMuted: '#7C8A81',
    background: '#101613',
    card: '#182019',
    backgroundElement: '#1E2721',
    backgroundSelected: '#28342C',
    border: '#243029',
    divider: '#20281F',
    primary: '#1FA678',
    primaryDark: '#14855F',
    primaryLight: '#22C08A',
    primaryTint: '#16332A',
    danger: '#E07A5F',
    dangerTint: '#3A2620',
    success: '#1FA678',
    successTint: '#16332A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Radii = {
  hero: 26,
  card: 22,
  row: 18,
  input: 14,
  pill: 99,
} as const;

export const FontWeights = [400, 500, 600, 700, 800] as const;
export type FontWeight = (typeof FontWeights)[number];

/** Manrope is a static (per-weight) font family, so weight selection maps to a family name. */
export const ManropeFamily: Record<FontWeight, string> = {
  400: 'Manrope_400Regular',
  500: 'Manrope_500Medium',
  600: 'Manrope_600SemiBold',
  700: 'Manrope_700Bold',
  800: 'Manrope_800ExtraBold',
};

export const Fonts = Platform.select({
  ios: { mono: 'ui-monospace' },
  default: { mono: 'monospace' },
  web: { mono: 'var(--font-mono)' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
