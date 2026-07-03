import { eq } from 'drizzle-orm';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db } from '@/db/client';
import {
  appSettings,
  categories,
  loans,
  payments,
  reminders,
  type AppearanceMode,
  type LoanStatus,
} from '@/db/schema';
import type { CurrencyCode } from '@/lib/currency';
import { convertCentsSync } from '@/lib/exchange-rates';
import { formatMoney } from '@/lib/format';
import { refreshAllLoanStatuses } from '@/lib/loan-status';
import { cancelAllScheduledNotifications, scheduleLoanReminder } from '@/lib/notifications';

export const BACKUP_SCHEMA_VERSION = 1;

type SettingsExport = {
  displayName: string;
  email: string | null;
  currency: CurrencyCode;
  appearance: AppearanceMode;
  defaultInterestRate: number;
  remindersEnabled: boolean;
  reminderDaysBefore: number;
};

type CategoryExport = { id: number; name: string; color: string | null; createdAt: number };

type LoanExport = {
  id: number;
  name: string;
  lender: string | null;
  categoryId: number | null;
  status: LoanStatus;
  principalCents: number;
  monthlyPaymentCents: number;
  interestRate: number;
  termMonths: number;
  startDate: number;
  firstPaymentDate: number | null;
  nextDueDate: number;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
};

type PaymentExport = {
  id: number;
  loanId: number;
  installmentNumber: number;
  dueDate: number;
  amountCents: number;
  principalPortionCents: number;
  interestPortionCents: number;
  isPaid: boolean;
  paidAt: number | null;
  note: string | null;
  createdAt: number;
};

type ReminderExport = {
  id: number;
  loanId: number;
  daysBefore: number;
  enabled: boolean;
  createdAt: number;
};

export type BackupFileV1 = {
  app: 'loan-wise';
  schemaVersion: 1;
  exportedAt: string;
  data: {
    settings: SettingsExport | null;
    categories: CategoryExport[];
    loans: LoanExport[];
    payments: PaymentExport[];
    reminders: ReminderExport[];
  };
};

function todayStamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function ensureSharingAvailable() {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
}

function writeAndShare(fileName: string, content: string, mimeType: string, uti: string) {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  return Sharing.shareAsync(file.uri, { mimeType, UTI: uti });
}

async function buildBackup(): Promise<BackupFileV1> {
  const [settingsRow] = await db.select().from(appSettings).limit(1);
  const categoryRows = await db.select().from(categories);
  const loanRows = await db.select().from(loans);
  const paymentRows = await db.select().from(payments);
  const reminderRows = await db.select().from(reminders);

  return {
    app: 'loan-wise',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: settingsRow
        ? {
            displayName: settingsRow.displayName,
            email: settingsRow.email,
            currency: settingsRow.currency,
            appearance: settingsRow.appearance,
            defaultInterestRate: settingsRow.defaultInterestRate,
            remindersEnabled: settingsRow.remindersEnabled,
            reminderDaysBefore: settingsRow.reminderDaysBefore,
          }
        : null,
      categories: categoryRows.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        createdAt: row.createdAt.getTime(),
      })),
      loans: loanRows.map((row) => ({
        id: row.id,
        name: row.name,
        lender: row.lender,
        categoryId: row.categoryId,
        status: row.status,
        principalCents: row.principalCents,
        monthlyPaymentCents: row.monthlyPaymentCents,
        interestRate: row.interestRate,
        termMonths: row.termMonths,
        startDate: row.startDate.getTime(),
        firstPaymentDate: row.firstPaymentDate ? row.firstPaymentDate.getTime() : null,
        nextDueDate: row.nextDueDate.getTime(),
        notes: row.notes,
        createdAt: row.createdAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
      })),
      payments: paymentRows.map((row) => ({
        id: row.id,
        loanId: row.loanId,
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate.getTime(),
        amountCents: row.amountCents,
        principalPortionCents: row.principalPortionCents,
        interestPortionCents: row.interestPortionCents,
        isPaid: row.isPaid,
        paidAt: row.paidAt ? row.paidAt.getTime() : null,
        note: row.note,
        createdAt: row.createdAt.getTime(),
      })),
      reminders: reminderRows.map((row) => ({
        id: row.id,
        loanId: row.loanId,
        daysBefore: row.daysBefore,
        enabled: row.enabled,
        createdAt: row.createdAt.getTime(),
      })),
    },
  };
}

export async function exportBackup(): Promise<void> {
  const backup = await buildBackup();
  await ensureSharingAvailable();
  await writeAndShare(
    `loan-wise-backup-${todayStamp()}.json`,
    JSON.stringify(backup, null, 2),
    'application/json',
    'public.json'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type BackupValidationResult = { ok: true; data: BackupFileV1 } | { ok: false; error: string };

/** Validates a parsed backup file's shape and referential integrity before anything touches the database. */
export function validateBackup(raw: unknown): BackupValidationResult {
  if (!isRecord(raw)) return { ok: false, error: 'File is not a valid backup (not a JSON object).' };
  if (raw.app !== 'loan-wise') return { ok: false, error: 'File is not a Loan Wise backup.' };
  if (typeof raw.schemaVersion !== 'number') {
    return { ok: false, error: 'Backup is missing a schema version.' };
  }
  if (raw.schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'This backup was created by a newer version of Loan Wise. Please update the app.' };
  }
  if (!isRecord(raw.data)) return { ok: false, error: 'Backup is missing its data section.' };

  const { categories: categoriesRaw, loans: loansRaw, payments: paymentsRaw, reminders: remindersRaw, settings: settingsRaw } =
    raw.data;

  if (
    !Array.isArray(categoriesRaw) ||
    !Array.isArray(loansRaw) ||
    !Array.isArray(paymentsRaw) ||
    !Array.isArray(remindersRaw)
  ) {
    return { ok: false, error: 'Backup data is malformed.' };
  }

  const categoryIds = new Set<number>();
  for (const category of categoriesRaw) {
    if (!isRecord(category) || typeof category.id !== 'number' || typeof category.name !== 'string') {
      return { ok: false, error: 'A category entry is malformed.' };
    }
    categoryIds.add(category.id);
  }

  const loanIds = new Set<number>();
  for (const loan of loansRaw) {
    if (
      !isRecord(loan) ||
      typeof loan.id !== 'number' ||
      typeof loan.name !== 'string' ||
      typeof loan.principalCents !== 'number' ||
      typeof loan.monthlyPaymentCents !== 'number' ||
      typeof loan.termMonths !== 'number' ||
      typeof loan.startDate !== 'number' ||
      typeof loan.nextDueDate !== 'number' ||
      typeof loan.createdAt !== 'number' ||
      typeof loan.updatedAt !== 'number'
    ) {
      return { ok: false, error: 'A loan entry is malformed.' };
    }
    if (loan.categoryId !== null && loan.categoryId !== undefined && !categoryIds.has(loan.categoryId as number)) {
      return { ok: false, error: 'A loan references a category that does not exist in the backup.' };
    }
    loanIds.add(loan.id);
  }

  const seenInstallments = new Set<string>();
  for (const payment of paymentsRaw) {
    if (
      !isRecord(payment) ||
      typeof payment.id !== 'number' ||
      typeof payment.loanId !== 'number' ||
      typeof payment.installmentNumber !== 'number' ||
      typeof payment.dueDate !== 'number' ||
      typeof payment.amountCents !== 'number' ||
      typeof payment.principalPortionCents !== 'number' ||
      typeof payment.interestPortionCents !== 'number' ||
      typeof payment.isPaid !== 'boolean'
    ) {
      return { ok: false, error: 'A payment entry is malformed.' };
    }
    if (!loanIds.has(payment.loanId)) {
      return { ok: false, error: 'A payment references a loan that does not exist in the backup.' };
    }
    const key = `${payment.loanId}-${payment.installmentNumber}`;
    if (seenInstallments.has(key)) {
      return { ok: false, error: 'Backup contains duplicate installments for a loan.' };
    }
    seenInstallments.add(key);
  }

  for (const reminder of remindersRaw) {
    if (!isRecord(reminder) || typeof reminder.id !== 'number' || typeof reminder.loanId !== 'number') {
      return { ok: false, error: 'A reminder entry is malformed.' };
    }
    if (!loanIds.has(reminder.loanId)) {
      return { ok: false, error: 'A reminder references a loan that does not exist in the backup.' };
    }
  }

  if (settingsRaw !== null && settingsRaw !== undefined && !isRecord(settingsRaw)) {
    return { ok: false, error: 'Backup settings are malformed.' };
  }

  return { ok: true, data: raw as BackupFileV1 };
}

/** Wipes every table and restores it from the backup, preserving original ids. Notifications are
 * cancelled up front (their ids die with the wipe) and reminders are rescheduled afterward. */
export async function importBackup(backup: BackupFileV1): Promise<void> {
  await cancelAllScheduledNotifications();

  // App lock is tied to this device's SecureStore PIN, not the backup's origin device —
  // never let a restore silently lock (or unlock) the app based on someone else's setting.
  const currentSettings = await db.query.appSettings.findFirst();
  const appLockEnabled = currentSettings?.appLockEnabled ?? false;

  db.transaction((tx) => {
    tx.delete(reminders).run();
    tx.delete(payments).run();
    tx.delete(loans).run();
    tx.delete(categories).run();
    tx.delete(appSettings).run();

    if (backup.data.categories.length > 0) {
      tx.insert(categories)
        .values(
          backup.data.categories.map((category) => ({
            id: category.id,
            name: category.name,
            color: category.color,
            createdAt: new Date(category.createdAt),
          }))
        )
        .run();
    }

    if (backup.data.loans.length > 0) {
      tx.insert(loans)
        .values(
          backup.data.loans.map((loan) => ({
            id: loan.id,
            name: loan.name,
            lender: loan.lender,
            categoryId: loan.categoryId,
            status: loan.status,
            principalCents: loan.principalCents,
            monthlyPaymentCents: loan.monthlyPaymentCents,
            interestRate: loan.interestRate,
            termMonths: loan.termMonths,
            startDate: new Date(loan.startDate),
            firstPaymentDate: loan.firstPaymentDate !== null ? new Date(loan.firstPaymentDate) : null,
            nextDueDate: new Date(loan.nextDueDate),
            notes: loan.notes,
            createdAt: new Date(loan.createdAt),
            updatedAt: new Date(loan.updatedAt),
          }))
        )
        .run();
    }

    if (backup.data.payments.length > 0) {
      tx.insert(payments)
        .values(
          backup.data.payments.map((payment) => ({
            id: payment.id,
            loanId: payment.loanId,
            installmentNumber: payment.installmentNumber,
            dueDate: new Date(payment.dueDate),
            amountCents: payment.amountCents,
            principalPortionCents: payment.principalPortionCents,
            interestPortionCents: payment.interestPortionCents,
            isPaid: payment.isPaid,
            paidAt: payment.paidAt !== null ? new Date(payment.paidAt) : null,
            note: payment.note,
            createdAt: new Date(payment.createdAt),
          }))
        )
        .run();
    }

    if (backup.data.reminders.length > 0) {
      tx.insert(reminders)
        .values(
          backup.data.reminders.map((reminder) => ({
            id: reminder.id,
            loanId: reminder.loanId,
            daysBefore: reminder.daysBefore,
            enabled: reminder.enabled,
            notificationId: null,
            createdAt: new Date(reminder.createdAt),
          }))
        )
        .run();
    }

    if (backup.data.settings) {
      tx.insert(appSettings)
        .values({
          displayName: backup.data.settings.displayName,
          email: backup.data.settings.email,
          currency: backup.data.settings.currency,
          appearance: backup.data.settings.appearance,
          defaultInterestRate: backup.data.settings.defaultInterestRate,
          remindersEnabled: backup.data.settings.remindersEnabled,
          reminderDaysBefore: backup.data.settings.reminderDaysBefore,
          appLockEnabled,
        })
        .run();
    }
  });

  await refreshAllLoanStatuses();

  const activeReminders = await db.query.reminders.findMany({
    where: eq(reminders.enabled, true),
    with: { loan: true },
  });
  const settings = await db.query.appSettings.findFirst();
  const currency = settings?.currency ?? 'PHP';

  for (const reminder of activeReminders) {
    if (reminder.loan.status === 'paid_off') continue;
    const notificationId = await scheduleLoanReminder({
      loanName: reminder.loan.name,
      amountLabel: formatMoney(convertCentsSync(reminder.loan.monthlyPaymentCents, currency), currency),
      dueDate: reminder.loan.nextDueDate,
      daysBefore: reminder.daysBefore,
    });
    await db.update(reminders).set({ notificationId }).where(eq(reminders.id, reminder.id));
  }
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function exportPaymentsCsv(): Promise<void> {
  const loanRows = await db.query.loans.findMany({ with: { payments: true, category: true } });

  const header = [
    'loan',
    'lender',
    'category',
    'installment',
    'due_date',
    'amount',
    'principal',
    'interest',
    'status',
    'paid_at',
    'note',
  ];
  const lines = [header.join(',')];

  for (const loan of loanRows) {
    for (const payment of loan.payments) {
      const row = [
        loan.name,
        loan.lender ?? '',
        loan.category?.name ?? '',
        String(payment.installmentNumber),
        payment.dueDate.toISOString().slice(0, 10),
        (payment.amountCents / 100).toFixed(2),
        (payment.principalPortionCents / 100).toFixed(2),
        (payment.interestPortionCents / 100).toFixed(2),
        payment.isPaid ? 'paid' : 'unpaid',
        payment.paidAt ? payment.paidAt.toISOString().slice(0, 10) : '',
        payment.note ?? '',
      ].map(csvEscape);
      lines.push(row.join(','));
    }
  }

  await ensureSharingAvailable();
  await writeAndShare(
    `loan-wise-payments-${todayStamp()}.csv`,
    '\uFEFF' + lines.join('\n'),
    'text/csv',
    'public.comma-separated-values-text'
  );
}
