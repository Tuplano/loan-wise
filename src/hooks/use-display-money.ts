import { useEffect, useState } from "react";

import { useAppSettings } from "@/hooks/use-app-settings";
import type { CurrencyCode } from "@/lib/currency";
import {
  BASE_CURRENCY,
  ensureRates,
  getCachedRate,
  getRatesFetchedAt,
} from "@/lib/exchange-rates";
import { formatMoney } from "@/lib/format";

/**
 * The app's single display currency, live-converted from the fixed storage currency (BASE_CURRENCY).
 * Loans are always entered/stored in BASE_CURRENCY; this hook only affects how amounts are *shown*.
 */
export function useDisplayMoney() {
  const settings = useAppSettings();
  const currency: CurrencyCode = settings?.currency ?? BASE_CURRENCY;

  const [rate, setRate] = useState<number | null>(getCachedRate(currency));
  const [fetchedAt, setFetchedAt] = useState<number | null>(
    getRatesFetchedAt(),
  );
  const [trackedCurrency, setTrackedCurrency] = useState(currency);

  // Snap to whatever's already cached the instant the display currency changes,
  // instead of showing a stale rate from the previous currency for a frame.
  if (currency !== trackedCurrency) {
    setTrackedCurrency(currency);
    setRate(getCachedRate(currency));
  }

  useEffect(() => {
    let cancelled = false;

    ensureRates().then((cache) => {
      if (cancelled) return;
      setRate(cache.rates[currency] ?? (currency === BASE_CURRENCY ? 1 : null));
      setFetchedAt(cache.fetchedAt || null);
    });

    return () => {
      cancelled = true;
    };
  }, [currency]);

  const effectiveRate = rate ?? 1;
  const isConverted = currency !== BASE_CURRENCY;
  const isLive = currency === BASE_CURRENCY || rate !== null;

  function format(baseCents: number) {
    const convertedCents = Math.round(baseCents * effectiveRate);
    return formatMoney(convertedCents, currency);
  }

  return {
    format,
    currency,
    isConverted,
    isLive,
    rate: effectiveRate,
    fetchedAt,
  };
}
