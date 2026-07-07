import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { loans } from './loans';
import { payments } from './payments';

export type TransactionKind = 'installment' | 'extra';

// Source of truth for money-in events. An installment row's paidCents/isPaid is a
// denormalized rollup of its transactions. An overpayment is stored as two rows:
// an 'installment' transaction for the remaining due plus an 'extra' transaction
// (all principal) for the overflow, sharing the same paymentId so undo reverses both.
// Standalone extra payments have paymentId = null.
export const paymentTransactions = sqliteTable('payment_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  loanId: integer('loan_id')
    .notNull()
    .references(() => loans.id, { onDelete: 'cascade' }),
  // 'set null' (not cascade): schedule-tail regeneration deletes unpaid rows, and the
  // money history must survive that.
  paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),

  kind: text('kind').$type<TransactionKind>().notNull().default('installment'),
  amountCents: integer('amount_cents').notNull(),
  principalAppliedCents: integer('principal_applied_cents').notNull(),
  interestAppliedCents: integer('interest_applied_cents').notNull(),

  paidAt: integer('paid_at', { mode: 'timestamp' }).notNull(),
  note: text('note'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
