import { relations } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export type LoanStatus = 'active' | 'paid_off' | 'overdue';

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

  interestRate: real('interest_rate').notNull().default(0), // annual %, e.g. 5.25
  termMonths: integer('term_months').notNull(),

  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
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

  amountCents: integer('amount_cents').notNull(),
  principalPortionCents: integer('principal_portion_cents'),
  interestPortionCents: integer('interest_portion_cents'),

  paidAt: integer('paid_at', { mode: 'timestamp' }).notNull(),
  note: text('note'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

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
