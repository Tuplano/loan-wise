import { File, Paths } from 'expo-file-system';

import type { CurrencyCode } from '@/lib/currency';

/** All monetary amounts are stored in this currency; every other currency is a converted display view. */
export const BASE_CURRENCY: CurrencyCode = 'PHP';

const CACHE_FILE_NAME = 'exchange-rates-cache.json';
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

type RateCache = {
  base: CurrencyCode;
  fetchedAt: number;
  rates: Partial<Record<CurrencyCode, number>>;
};

let memoryCache: RateCache | null = null;
let inFlightFetch: Promise<RateCache> | null = null;

function cacheFile() {
  return new File(Paths.document, CACHE_FILE_NAME);
}

function readCacheFromDisk(): RateCache | null {
  try {
    const file = cacheFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync()) as RateCache;
    return parsed.base === BASE_CURRENCY ? parsed : null;
  } catch {
    return null;
  }
}

function writeCacheToDisk(cache: RateCache) {
  try {
    const file = cacheFile();
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(cache));
  } catch {
    // Best-effort: a failed write just means we re-fetch next launch.
  }
}

async function fetchRates(): Promise<RateCache> {
  const response = await fetch(`https://open.er-api.com/v6/latest/${BASE_CURRENCY}`);
  if (!response.ok) throw new Error(`Exchange rate request failed: ${response.status}`);
  const json = await response.json();
  if (json.result !== 'success') throw new Error('Exchange rate provider returned an error');

  const cache: RateCache = { base: BASE_CURRENCY, fetchedAt: Date.now(), rates: json.rates };
  writeCacheToDisk(cache);
  memoryCache = cache;
  return cache;
}

/**
 * Returns the freshest available rate cache. Never throws or blocks on the network longer than
 * necessary — returns a stale/disk cache immediately while a refresh happens in the background,
 * and only awaits a live fetch the very first time the app has no cache at all.
 */
export async function ensureRates(): Promise<RateCache> {
  if (!memoryCache) memoryCache = readCacheFromDisk();

  const isStale = !memoryCache || Date.now() - memoryCache.fetchedAt >= REFRESH_INTERVAL_MS;
  if (!isStale) return memoryCache!;

  if (!inFlightFetch) {
    inFlightFetch = fetchRates()
      .catch(() => memoryCache ?? { base: BASE_CURRENCY, fetchedAt: 0, rates: {} })
      .finally(() => {
        inFlightFetch = null;
      });
  }
  return memoryCache ?? inFlightFetch;
}

/** Synchronous best-effort lookup — whatever is currently cached in memory, or null if nothing has loaded yet. */
export function getCachedRate(currency: CurrencyCode): number | null {
  if (currency === BASE_CURRENCY) return 1;
  return memoryCache?.rates[currency] ?? null;
}

export function getRatesFetchedAt(): number | null {
  return memoryCache?.fetchedAt || null;
}

/** Converts using whatever rate is currently cached; falls back to the unconverted amount if no rate is known yet. */
export function convertCentsSync(baseCents: number, currency: CurrencyCode): number {
  const rate = getCachedRate(currency);
  return rate === null ? baseCents : Math.round(baseCents * rate);
}
