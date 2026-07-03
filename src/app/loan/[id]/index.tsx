import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogPaymentModal } from '@/components/log-payment-modal';
import { PaymentNoteModal } from '@/components/payment-note-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PillBadge } from '@/components/ui/pill-badge';
import { PrimaryButton } from '@/components/ui/primary-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ProgressRing } from '@/components/ui/progress-ring';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { loans, payments, reminders, type LoanStatus } from '@/db/schema';
import { useDisplayMoney } from '@/hooks/use-display-money';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, ordinalSuffix } from '@/lib/date';
import { convertCentsSync } from '@/lib/exchange-rates';
import { formatMoney } from '@/lib/format';
import { cancelReminder, scheduleLoanReminder } from '@/lib/notifications';
import {
  applyExtraPayment,
  applyInstallmentPayment,
  sumExtraPrincipal,
  undoInstallmentPayments,
} from '@/lib/payment-actions';
import { extraPaymentCapacityCents, getScheduleForLoan, remainingDueCents, scheduleAnchor } from '@/lib/schedule';

const statusLabel: Record<LoanStatus, string> = {
  active: 'Active',
  paid_off: 'Paid off',
  overdue: 'Overdue',
};

export default function LoanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const theme = useTheme();
  const { format, currency } = useDisplayMoney();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [notePaymentId, setNotePaymentId] = useState<number | null>(null);
  const [modalState, setModalState] = useState<
    { mode: 'installment'; paymentId: number } | { mode: 'extra' } | null
  >(null);

  const { data: loanResult } = useLiveQuery(
    db.query.loans.findFirst({
      where: eq(loans.id, loanId),
      with: {
        category: true,
        payments: { orderBy: (fields, { asc }) => [asc(fields.installmentNumber)] },
        reminders: true,
        transactions: true,
      },
    })
  );

  if (!loanResult) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText themeColor="textSecondary">Loan not found.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const loan = loanResult;
  const paidCount = loan.payments.filter((payment) => payment.isPaid).length;
  const reminder = loan.reminders[0];

  const schedule = getScheduleForLoan(loan.payments);

  const principalPaidCents = loan.transactions.reduce(
    (sum, transaction) => sum + transaction.principalAppliedCents,
    0
  );
  const paidOffProgress =
    loan.principalCents > 0 ? Math.min(principalPaidCents / loan.principalCents, 1) : 0;

  const extraPrincipalCents = sumExtraPrincipal(loan.transactions);
  const extraCapacityCents = extraPaymentCapacityCents(loan, loan.payments, extraPrincipalCents);

  const basePaymentCents = Math.round(loan.principalCents / loan.termMonths);
  const interestPaymentCents = loan.monthlyPaymentCents - basePaymentCents;

  const modalRow =
    modalState?.mode === 'installment'
      ? loan.payments.find((payment) => payment.id === modalState.paymentId)
      : undefined;
  const modalRemainingCents = modalRow ? remainingDueCents(modalRow) : 0;
  // In installment mode the cap is the row's remainder plus whatever the tail can still
  // absorb once this row is locked; in extra mode it's just the tail's capacity.
  const modalMaxCents = modalRow
    ? modalRemainingCents +
      extraPaymentCapacityCents(
        loan,
        loan.payments.map((payment) =>
          payment.id === modalRow.id
            ? { ...payment, paidCents: Math.max(payment.paidCents, 1) }
            : payment
        ),
        extraPrincipalCents
      )
    : extraCapacityCents;

  async function handleToggleReminder() {
    if (reminder) {
      const nextEnabled = !reminder.enabled;
      if (nextEnabled) {
        const notificationId = await scheduleLoanReminder({
          loanName: loan.name,
          amountLabel: formatMoney(convertCentsSync(loan.monthlyPaymentCents, currency), currency),
          dueDate: loan.nextDueDate,
          daysBefore: reminder.daysBefore,
        });
        await db
          .update(reminders)
          .set({ enabled: true, notificationId })
          .where(eq(reminders.id, reminder.id));
      } else {
        await cancelReminder(reminder.notificationId);
        await db
          .update(reminders)
          .set({ enabled: false, notificationId: null })
          .where(eq(reminders.id, reminder.id));
      }
      return;
    }

    const settings = await db.query.appSettings.findFirst();
    const daysBefore = settings?.reminderDaysBefore ?? 3;
    const notificationId = await scheduleLoanReminder({
      loanName: loan.name,
      amountLabel: formatMoney(convertCentsSync(loan.monthlyPaymentCents, currency), currency),
      dueDate: loan.nextDueDate,
      daysBefore,
    });
    await db.insert(reminders).values({
      loanId: loan.id,
      daysBefore,
      enabled: true,
      notificationId,
    });
  }

  async function handleConfirmPayment(amountCents: number, paidAt: Date) {
    if (processing) return;
    setProcessing(true);

    try {
      if (modalState?.mode === 'installment') {
        await applyInstallmentPayment({
          loanId: loan.id,
          paymentId: modalState.paymentId,
          amountCents,
          paidAt,
        });
      } else {
        await applyExtraPayment({ loanId: loan.id, amountCents, paidAt });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setProcessing(false);
    }
  }

  function handleUndo(paymentId: number) {
    Alert.alert(
      'Undo payments',
      'Remove every payment logged for this month? The schedule will regrow if extra principal was applied.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Undo',
          style: 'destructive',
          onPress: async () => {
            if (processing) return;
            setProcessing(true);
            try {
              await undoInstallmentPayments(paymentId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  }

  async function handleSaveNote(paymentId: number, note: string | null) {
    await db.update(payments).set({ note }).where(eq(payments.id, paymentId));
  }

  function handleDelete() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Delete loan', `Delete "${loan.name}"? This also removes its payment history.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (reminder?.notificationId) {
            await cancelReminder(reminder.notificationId);
          }
          await db.delete(loans).where(eq(loans.id, loan.id));
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: loan.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={handleToggleReminder} hitSlop={8}>
                <SymbolView
                  tintColor={theme.primary}
                  name={{
                    ios: reminder?.enabled ? 'bell.fill' : 'bell',
                    android: reminder?.enabled ? 'notifications_active' : 'notifications_none',
                    web: reminder?.enabled ? 'notifications_active' : 'notifications_none',
                  }}
                  size={20}
                />
              </Pressable>
              <Pressable onPress={() => router.push(`/loan/${loan.id}/edit`)} hitSlop={8}>
                <ThemedText type="linkPrimary">Edit</ThemedText>
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={8}>
                <SymbolView
                  tintColor={theme.danger}
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  size={20}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <FlatList
            style={styles.list}
            data={schedule}
            keyExtractor={(item) => String(item.index)}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.header}>
                <View style={styles.titleBlock}>
                  <PillBadge
                    label={loan.category?.name ?? statusLabel[loan.status]}
                    color={loan.category?.color ?? undefined}
                  />
                  <ThemedText type="title" style={styles.titleText}>
                    {loan.name}
                  </ThemedText>
                  {loan.lender && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {loan.lender}
                    </ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textMuted">
                    Started {formatDate(loan.startDate)} · Due every{' '}
                    {scheduleAnchor(loan).getDate()}
                    {ordinalSuffix(scheduleAnchor(loan).getDate())}
                  </ThemedText>
                </View>

                <View style={styles.ringWrap}>
                  <ProgressRing progress={paidOffProgress} size={168} strokeWidth={14}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Paid off
                    </ThemedText>
                    <ThemedText type="display" numeric style={{ color: theme.primaryDark }}>
                      {Math.round(paidOffProgress * 100)}%
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numeric>
                      {format(principalPaidCents)} of {format(loan.principalCents)}
                    </ThemedText>
                  </ProgressRing>
                </View>

                <View style={styles.statsGrid}>
                  <StatCard label="Principal" value={format(loan.principalCents)} />
                  <StatCard label="Monthly" value={format(loan.monthlyPaymentCents)} />
                </View>

                <View style={[styles.breakdownCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.breakdownTitle}>
                    Payment breakdown
                  </ThemedText>
                  <View style={styles.breakdownRow}>
                    <ThemedText type="small">
                      Base ({format(loan.principalCents)} ÷ {loan.termMonths} mo)
                    </ThemedText>
                    <ThemedText type="smallBold" numeric>
                      {format(basePaymentCents)}
                    </ThemedText>
                  </View>
                  <View style={styles.breakdownRow}>
                    <ThemedText type="small">Interest ({loan.interestRate}% / mo)</ThemedText>
                    <ThemedText type="smallBold" numeric>
                      {format(interestPaymentCents)}
                    </ThemedText>
                  </View>
                  <View style={[styles.breakdownRow, styles.breakdownTotal, { borderTopColor: theme.divider }]}>
                    <ThemedText type="smallBold">Monthly due</ThemedText>
                    <ThemedText type="smallBold" numeric style={{ color: theme.primaryDark }}>
                      {format(loan.monthlyPaymentCents)}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.miniStatsRow}>
                  <MiniStat value={`${loan.termMonths} mo`} label="Term" />
                  <MiniStat value={`${Math.max(loan.payments.length - paidCount, 0)} mo`} label="Left" />
                  <MiniStat value={`${loan.interestRate}%`} label="Interest" />
                </View>

                {loan.status !== 'paid_off' && extraCapacityCents > 0 && (
                  <PrimaryButton
                    label="Log extra payment"
                    onPress={() => setModalState({ mode: 'extra' })}
                    disabled={processing}
                  />
                )}

                {loan.notes && (
                  <View style={[styles.notesBox, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="small">{loan.notes}</ThemedText>
                  </View>
                )}

                <ThemedText type="smallBold" style={styles.scheduleLabel}>
                  Payment schedule ({paidCount}/{loan.payments.length} paid)
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Tap any month to log a payment — full, partial, or more. Tap a paid month to
                  undo it.
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => {
              const subtitle = item.paid
                ? `Paid ${formatDate(item.payment.paidAt!)}`
                : item.partial
                  ? `${format(item.paidCents)} of ${format(item.amountCents)} paid · due ${formatDate(item.dueDate)}`
                  : `Due ${formatDate(item.dueDate)}`;
              const trailingNote = item.paid
                ? item.onTime
                  ? 'On time'
                  : `${item.daysLate}d late`
                : item.partial
                  ? 'Partial'
                  : item.dueDate.getTime() < Date.now()
                    ? 'Overdue'
                    : 'Upcoming';

              return (
                <Pressable
                  onPress={() =>
                    item.paid
                      ? handleUndo(item.payment.id)
                      : setModalState({ mode: 'installment', paymentId: item.payment.id })
                  }
                  onLongPress={() => {
                    if (item.partial) handleUndo(item.payment.id);
                  }}
                  disabled={processing}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <View style={[styles.scheduleRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View
                      style={[
                        styles.scheduleIcon,
                        {
                          backgroundColor:
                            item.paid || item.partial ? theme.successTint : theme.backgroundElement,
                        },
                      ]}>
                      {item.paid ? (
                        <SymbolView
                          tintColor={theme.primary}
                          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                          size={15}
                        />
                      ) : (
                        <ThemedText
                          type="smallBold"
                          themeColor={item.partial ? 'text' : 'textSecondary'}>
                          {item.index + 1}
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.scheduleLeading}>
                      <ThemedText type="smallBold">Month {item.index + 1}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {subtitle}
                      </ThemedText>
                      {item.partial && (
                        <View style={styles.partialBar}>
                          <ProgressBar progress={item.paidCents / item.amountCents} height={4} />
                        </View>
                      )}
                      {item.payment.note && (
                        <ThemedText type="small" themeColor="textMuted" numberOfLines={2}>
                          {item.payment.note}
                        </ThemedText>
                      )}
                    </View>
                    <View style={styles.scheduleTrailing}>
                      <ThemedText type="smallBold" numeric themeColor={item.paid ? 'text' : 'textSecondary'}>
                        {item.partial ? format(item.remainingCents) : format(item.amountCents)}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        themeColor={!item.paid && trailingNote === 'Overdue' ? 'danger' : 'textSecondary'}>
                        {trailingNote}
                      </ThemedText>
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() => setNotePaymentId(item.payment.id)}
                      style={styles.noteButton}>
                      <SymbolView
                        tintColor={item.payment.note ? theme.primary : theme.textSecondary}
                        name={{
                          ios: item.payment.note ? 'note.text' : 'square.and.pencil',
                          android: 'edit_note',
                          web: 'edit_note',
                        }}
                        size={17}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          />
        </View>
      </SafeAreaView>
      <PaymentNoteModal
        visible={notePaymentId !== null}
        initialNote={loan.payments.find((payment) => payment.id === notePaymentId)?.note ?? null}
        onSave={(note) => {
          if (notePaymentId !== null) handleSaveNote(notePaymentId, note);
        }}
        onClose={() => setNotePaymentId(null)}
      />
      <LogPaymentModal
        visible={modalState !== null}
        mode={modalState?.mode ?? 'installment'}
        remainingDueCents={modalRemainingCents}
        maxAmountCents={modalMaxCents}
        onConfirm={handleConfirmPayment}
        onClose={() => setModalState(null)}
      />
    </ThemedView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numeric style={styles.statCardValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.miniStat, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ThemedText type="smallBold" numeric style={styles.statCardValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  header: {
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  titleText: {
    marginTop: Spacing.one,
  },
  ringWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.row - 2,
    padding: Spacing.three - 3,
  },
  statCardValue: {
    fontSize: 17,
    marginTop: 2,
  },
  breakdownCard: {
    borderWidth: 1,
    borderRadius: Radii.card - 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  breakdownTitle: {
    marginBottom: Spacing.one,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownTotal: {
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  miniStatsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radii.row - 2,
    paddingVertical: Spacing.two + 2,
  },
  notesBox: {
    borderRadius: Radii.row - 2,
    padding: Spacing.three,
  },
  scheduleLabel: {
    paddingTop: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: Radii.row,
    padding: Spacing.three - 3,
  },
  scheduleIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleLeading: {
    flex: 1,
    gap: 1,
  },
  partialBar: {
    marginTop: 3,
    marginBottom: 2,
    maxWidth: 140,
  },
  scheduleTrailing: {
    alignItems: 'flex-end',
    gap: 1,
  },
  noteButton: {
    padding: Spacing.one,
  },
});
