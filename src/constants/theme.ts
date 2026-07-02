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
    text: '#EDF4EF',
    textSecondary: '#A7B8AE',
    textMuted: '#889A90',
    background: '#0B100E',
    card: '#17201C',
    backgroundElement: '#222D28',
    backgroundSelected: '#34443D',
    border: '#3F4F49',
    divider: '#293530',
    primary: '#1D875A',
    primaryDark: '#5FE0AE',
    primaryLight: '#3ED9A2',
    primaryTint: '#154933',
    danger: '#F0876A',
    dangerTint: '#592D1A',
    success: '#1D875A',
    successTint: '#154933',
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
