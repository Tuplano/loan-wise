import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { loans } from './loans';

export const reminders = sqliteTable('reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanId: integer('loan_id')
    .notNull()
    .references(() => loans.id, { onDelete: 'cascade' }),

  daysBefore: integer('days_before').notNull().default(3),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  notificationId: text('notification_id'), // id returned by expo-notifications, for cancel/reschedule

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
