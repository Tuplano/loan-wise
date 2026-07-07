import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { categories } from './categories';

export type LoanStatus = 'active' | 'paid_off' | 'overdue';

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
