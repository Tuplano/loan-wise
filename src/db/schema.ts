import { relations } from 'drizzle-orm';
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { CurrencyCode } from '@/lib/currency';

export type LoanStatus = 'active' | 'paid_off' | 'overdue';
export type AppearanceMode = 'system' | 'light' | 'dark';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const loans = sqliteTable('loans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  lender: text('lender'),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  status: text('status').$type<LoanStatus>().notNull().default('active'),

  // Money stored as integer cents to avoid floating-point rounding errors.
  principalCents: integer('principal_cents').notNull(),
  monthlyPaymentCents: integer('monthly_payment_cents').notNull(),

  interestRate: real('interest_rate').notNull().default(0), // flat monthly %, e.g. 1.5
  termMonths: integer('term_months').notNull(),

  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  // Anchors the recurring monthly schedule (day-of-month for every installment).
  // Nullable so existing loans fall back to startDate; new loans always set it.
  firstPaymentDate: integer('first_payment_date', { mode: 'timestamp' }),
  nextDueDate: integer('next_due_date', { mode: 'timestamp' }).notNull(),

  notes: text('notes'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanId: integer('loan_id')
    .notNull()
    .references(() => loans.id, { onDelete: 'cascade' }),

  // 1-based position in the loan's schedule (1..termMonths). Every installment row
  // is created up front so any month can be tapped and marked paid, in any order.
  installmentNumber: integer('installment_number').notNull(),
  dueDate: integer('due_date', { mode: 'timestamp' }).notNull(),

  amountCents: integer('amount_cents').notNull(),
  principalPortionCents: integer('principal_portion_cents').notNull(),
  interestPortionCents: integer('interest_portion_cents').notNull(),

  isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  note: text('note'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('payments_loan_installment_idx').on(table.loanId, table.installmentNumber),
]);

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

export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  displayName: text('display_name').notNull().default('You'),
  email: text('email'),
  currency: text('currency').$type<CurrencyCode>().notNull().default('PHP'),
  appearance: text('appearance').$type<AppearanceMode>().notNull().default('system'),
  defaultInterestRate: real('default_interest_rate').notNull().default(0),
  remindersEnabled: integer('reminders_enabled', { mode: 'boolean' }).notNull().default(true),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(3),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  loans: many(loans),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  category: one(categories, {
    fields: [loans.categoryId],
    references: [categories.id],
  }),
  payments: many(payments),
  reminders: many(reminders),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  loan: one(loans, {
    fields: [payments.loanId],
    references: [loans.id],
  }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  loan: one(loans, {
    fields: [reminders.loanId],
    references: [loans.id],
  }),
}));
