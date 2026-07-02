import { currencyLocale, type CurrencyCode } from './currency';

export function formatMoney(cents: number, currency: CurrencyCode = 'PHP') {
  return (cents / 100).toLocaleString(currencyLocale(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
