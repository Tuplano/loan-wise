import { useAppSettings } from '@/hooks/use-app-settings';
import type { CurrencyCode } from '@/lib/currency';

/** Only safe to use after migrations have completed — the app_settings table must exist. */
export function useCurrency(): CurrencyCode {
  const settings = useAppSettings();
  return settings?.currency ?? 'PHP';
}
