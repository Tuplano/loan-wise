/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useEffectiveColorScheme } from '@/hooks/use-effective-color-scheme';

export function useTheme() {
  return Colors[useEffectiveColorScheme()];
}
