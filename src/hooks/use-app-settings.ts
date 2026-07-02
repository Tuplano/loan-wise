import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';

/** Only safe to use after migrations have completed — the app_settings table must exist. */
export function useAppSettings() {
  const { data } = useLiveQuery(db.query.appSettings.findFirst());
  return data;
}
