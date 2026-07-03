import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PaymentNoteModalProps = {
  visible: boolean;
  initialNote: string | null;
  onSave: (note: string | null) => void;
  onClose: () => void;
};

export function PaymentNoteModal({ visible, initialNote, onSave, onClose }: PaymentNoteModalProps) {
  const theme = useTheme();
  const [note, setNote] = useState(initialNote ?? '');

  useEffect(() => {
    if (visible) setNote(initialNote ?? '');
  }, [visible, initialNote]);

  function handleSave() {
    const trimmed = note.trim();
    onSave(trimmed.length > 0 ? trimmed : null);
    onClose();
  }

  function handleRemove() {
    onSave(null);
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
            Payment note
          </ThemedText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Anything worth remembering about this payment"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={3}
            autoFocus
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
            ]}
          />
          <View style={styles.actions}>
            {initialNote && (
              <Pressable onPress={handleRemove} hitSlop={8} style={styles.removeButton}>
                <ThemedText type="smallBold" themeColor="danger">
                  Remove note
                </ThemedText>
              </Pressable>
            )}
            <View style={styles.rightActions}>
              <Pressable onPress={onClose} hitSlop={8} style={styles.cancelButton}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
              <PrimaryButton label="Save" onPress={handleSave} />
            </View>
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
    padding: Spacing.two + 2,
    minHeight: 90,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  removeButton: {
    paddingVertical: Spacing.two,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginLeft: 'auto',
  },
  cancelButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
});
