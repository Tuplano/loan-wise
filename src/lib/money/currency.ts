export type CurrencyCode = 'PHP' | 'USD' | 'EUR' | 'GBP' | 'JPY';

export const CURRENCY_OPTIONS: { code: CurrencyCode; label: string; locale: string }[] = [
  { code: 'PHP', label: 'Philippine Peso', locale: 'en-PH' },
  { code: 'USD', label: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', label: 'Euro', locale: 'de-DE' },
  { code: 'GBP', label: 'British Pound', locale: 'en-GB' },
  { code: 'JPY', label: 'Japanese Yen', locale: 'ja-JP' },
];

export function currencyLocale(currency: CurrencyCode) {
  return CURRENCY_OPTIONS.find((option) => option.code === currency)?.locale ?? 'en-US';
}
