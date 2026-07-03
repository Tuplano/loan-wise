import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DateField } from '@/components/ui/date-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BASE_CURRENCY } from '@/lib/exchange-rates';
import { formatMoney } from '@/lib/format';

function toCents(value: string) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function toInput(cents: number) {
  return (cents / 100).toFixed(2);
}

type LogPaymentModalProps = {
  visible: boolean;
  mode: 'installment' | 'extra';
  /** Installment mode: what's still owed on the row. Ignored in extra mode. */
  remainingDueCents: number;
  /** Hard cap — remaining due plus what the schedule tail can absorb (or just the
   * tail's capacity in extra mode). Anything above is clamped to this. */
  maxAmountCents: number;
  onConfirm: (amountCents: number, paidAt: Date) => void;
  onClose: () => void;
};

export function LogPaymentModal({
  visible,
  mode,
  remainingDueCents,
  maxAmountCents,
  onConfirm,
  onClose,
}: LogPaymentModalProps) {
  const theme = useTheme();
  const [paidAt, setPaidAt] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);

  // Re-seed the drafts each time the modal opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPaidAt(new Date());
      setAmount(mode === 'installment' ? toInput(remainingDueCents) : '');
    }
  }

  const enteredCents = toCents(amount);
  const amountCents = enteredCents !== null ? Math.min(enteredCents, maxAmountCents) : null;
  const overCap = enteredCents !== null && enteredCents > maxAmountCents;
  const extraCents =
    mode === 'installment' && amountCents !== null
      ? Math.max(amountCents - remainingDueCents, 0)
      : 0;
  const shortCents =
    mode === 'installment' && amountCents !== null
      ? Math.max(remainingDueCents - amountCents, 0)
      : 0;

  let helper: string | null = null;
  if (amountCents !== null && amountCents > 0) {
    if (overCap) {
      helper = `Capped at the payoff amount: ${formatMoney(maxAmountCents, BASE_CURRENCY)}.`;
    } else if (mode === 'extra') {
      helper =
        amountCents >= maxAmountCents
          ? 'This pays off the loan.'
          : 'Goes straight to principal and knocks months off the end of your loan.';
    } else if (shortCents > 0) {
      helper = `Partial — ${formatMoney(shortCents, BASE_CURRENCY)} will still be due for this month.`;
    } else if (extraCents > 0) {
      helper = `${formatMoney(extraCents, BASE_CURRENCY)} extra goes to principal and shortens your loan.`;
    }
  }

  const chips =
    mode === 'installment'
      ? [
          { label: 'Full amount', cents: remainingDueCents },
          { label: 'Half', cents: Math.round(remainingDueCents / 2) },
        ]
      : [{ label: 'Payoff', cents: maxAmountCents }];

  function handleConfirm() {
    if (amountCents === null || amountCents <= 0) return;
    const now = new Date();
    onConfirm(amountCents, paidAt.getTime() > now.getTime() ? now : paidAt);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ThemedText type="smallBold" style={styles.title}>
            {mode === 'installment' ? 'Log payment' : 'Log extra payment'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {mode === 'installment'
              ? `${formatMoney(remainingDueCents, BASE_CURRENCY)} due — pay part of it, all of it, or more.`
              : 'Extra payments go straight to principal, so you finish (and stop paying interest) sooner.'}
          </ThemedText>

          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
            ]}
          />

          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <Pressable key={chip.label} onPress={() => setAmount(toInput(chip.cents))}>
                <View
                  style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{chip.label}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>

          {helper && (
            <ThemedText type="small" themeColor={overCap ? 'danger' : 'textSecondary'}>
              {helper}
            </ThemedText>
          )}

          <DateField label="Payment date" value={paidAt} onChange={setPaidAt} />
          <View style={styles.actions}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.cancelButton}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
            <PrimaryButton
              label="Log payment"
              onPress={handleConfirm}
              disabled={amountCents === null || amountCents <= 0}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: Radii.card,
    padding: Spacing.three + 2,
    gap: Spacing.three - 2,
  },
  title: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radii.input,
    paddingHorizontal: Spacing.three - 1,
    height: 50,
    fontSize: 17,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three - 1,
    paddingVertical: Spacing.two,
    borderRadius: Radii.row - 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  cancelButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
});
