import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { loans } from './loans';

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

  // Rollup of money applied to this installment so far (see payment_transactions).
  // isPaid stays the source of truth for "settled": paidCents >= amountCents.
  paidCents: integer('paid_cents').notNull().default(0),

  isPaid: integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  note: text('note'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  uniqueIndex('payments_loan_installment_idx').on(table.loanId, table.installmentNumber),
]);
