import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { DateField } from '@/components/ui/date-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LogPaymentModalProps = {
  visible: boolean;
  amountLabel: string;
  onConfirm: (paidAt: Date) => void;
  onClose: () => void;
};

export function LogPaymentModal({ visible, amountLabel, onConfirm, onClose }: LogPaymentModalProps) {
  const theme = useTheme();
  const [paidAt, setPaidAt] = useState(new Date());
  const [wasVisible, setWasVisible] = useState(visible);

  // Re-seed the draft to today each time the modal opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPaidAt(new Date());
  }

  function handleConfirm() {
    const now = new Date();
    onConfirm(paidAt.getTime() > now.getTime() ? now : paidAt);
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
            Log payment
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {amountLabel} · defaults to today — change it if you&apos;re logging this late.
          </ThemedText>
          <DateField label="Payment date" value={paidAt} onChange={setPaidAt} />
          <View style={styles.actions}>
            <Pressable onPress={onClose} hitSlop={8} style={styles.cancelButton}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
            <PrimaryButton label="Mark as paid" onPress={handleConfirm} />
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
