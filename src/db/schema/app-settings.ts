import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { CurrencyCode } from '@/lib/money/currency';

export type AppearanceMode = 'system' | 'light' | 'dark';

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull().default('You'),
  email: text('email'),
  currency: text('currency').$type<CurrencyCode>().notNull().default('PHP'),
  appearance: text('appearance').$type<AppearanceMode>().notNull().default('system'),
  defaultInterestRate: real('default_interest_rate').notNull().default(0),
  remindersEnabled: integer('reminders_enabled', { mode: 'boolean' }).notNull().default(true),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(3),
  appLockEnabled: integer('app_lock_enabled', { mode: 'boolean' }).notNull().default(false),
});
