import { relations } from 'drizzle-orm';

import { categories } from './categories';
import { loans } from './loans';
import { paymentTransactions } from './payment-transactions';
import { payments } from './payments';
import { reminders } from './reminders';

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
  transactions: many(paymentTransactions),
}));

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  loan: one(loans, {
    fields: [payments.loanId],
    references: [loans.id],
  }),
  transactions: many(paymentTransactions),
}));

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  loan: one(loans, {
    fields: [paymentTransactions.loanId],
    references: [loans.id],
  }),
  payment: one(payments, {
    fields: [paymentTransactions.paymentId],
    references: [payments.id],
  }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  loan: one(loans, {
    fields: [reminders.loanId],
    references: [loans.id],
  }),
}));
