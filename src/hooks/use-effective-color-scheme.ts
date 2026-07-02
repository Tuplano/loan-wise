import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppSettings } from '@/hooks/use-app-settings';

/** System scheme overridden by the user's Appearance setting, if they picked one. */
export function useEffectiveColorScheme(): 'light' | 'dark' {
  const systemScheme = useColorScheme();
  const settings = useAppSettings();
  const appearance = settings?.appearance ?? 'system';

  if (appearance === 'light' || appearance === 'dark') return appearance;
  return systemScheme === 'dark' ? 'dark' : 'light';
}
