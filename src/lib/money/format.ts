import { currencyLocale, type CurrencyCode } from './currency';

export function formatMoney(cents: number, currency: CurrencyCode = 'PHP') {
  return (cents / 100).toLocaleString(currencyLocale(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** The currency's symbol/prefix alone, e.g. "₱" — derived by formatting zero and stripping digits,
 * since Hermes doesn't reliably expose the symbol any other way. */
function currencySymbol(currency: CurrencyCode) {
  return formatMoney(0, currency).replace(/[\d.,\s]/g, '');
}

/** Short form for axis labels, e.g. ₱1.2K instead of ₱1,200.00. Built manually rather than via
 * Intl's `notation: 'compact'` — Hermes silently falls back to the full (unabbreviated) number
 * for locale/currency pairs it has no compact pattern for, which then overflows a narrow axis. */
export function formatCompactMoney(majorAmount: number, currency: CurrencyCode = 'PHP') {
  const abs = Math.abs(majorAmount);
  const [divisor, suffix] =
    abs >= 1_000_000_000 ? [1_000_000_000, 'B'] : abs >= 1_000_000 ? [1_000_000, 'M'] : abs >= 1_000 ? [1_000, 'K'] : [1, ''];
  const scaled = majorAmount / divisor;
  const value = suffix ? scaled.toFixed(scaled !== 0 && Math.abs(scaled) < 10 ? 1 : 0) : Math.round(scaled).toString();
  return `${currencySymbol(currency)}${value}${suffix}`;
}
