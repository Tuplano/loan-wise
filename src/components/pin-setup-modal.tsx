import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { PinPad } from '@/components/ui/pin-pad';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PIN_LENGTH = 4;

type PinSetupModalProps = {
  visible: boolean;
  onComplete: (pin: string) => void;
  onCancel: () => void;
};

export function PinSetupModal({ visible, onComplete, onCancel }: PinSetupModalProps) {
  const theme = useTheme();
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  function reset() {
    setStage('enter');
    setFirstPin('');
    setPin('');
    setError(false);
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  function handleDigit(digit: string) {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError(false);

    if (next.length !== PIN_LENGTH) return;

    if (stage === 'enter') {
      setFirstPin(next);
      setPin('');
      setStage('confirm');
      return;
    }

    if (next === firstPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onComplete(next);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(true);
      setTimeout(() => {
        setPin('');
        setFirstPin('');
        setStage('enter');
        setError(false);
      }, 500);
    }
  }

  function handleBackspace() {
    setError(false);
    setPin((current) => current.slice(0, -1));
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.topBar}>
          <Pressable onPress={handleCancel} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.header}>
            <ThemedText type="display" style={styles.title}>
              {stage === 'enter' ? 'Set a PIN' : 'Confirm your PIN'}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {error
                ? "PINs didn't match, try again"
                : stage === 'enter'
                  ? 'Choose a 4-digit PIN to lock the app'
                  : 'Enter it again to confirm'}
            </ThemedText>
          </View>

          <PinPad
            length={PIN_LENGTH}
            filled={pin.length}
            error={error}
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            backspaceIcon={
              <SymbolView
                tintColor={theme.text}
                name={{ ios: 'delete.left', android: 'backspace', web: 'backspace' }}
                size={28}
              />
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: Spacing.three,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
    paddingHorizontal: Spacing.two,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
  },
});
