import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from '@/db/schema';

export const expoDb = openDatabaseSync('loan-wise.db', { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });
