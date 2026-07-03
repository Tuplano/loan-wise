import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PinPad } from '@/components/ui/pin-pad';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authenticateBiometric, canUseBiometrics, verifyPin } from '@/lib/app-lock';

const PIN_LENGTH = 4;

type LockScreenProps = {
  onUnlock: () => void;
  onCancel?: () => void;
};

export function LockScreen({ onUnlock, onCancel }: LockScreenProps) {
  const theme = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  const tryBiometric = useCallback(async () => {
    const available = await canUseBiometrics();
    setBiometricsAvailable(available);
    if (available) {
      const success = await authenticateBiometric();
      if (success) onUnlock();
    }
  }, [onUnlock]);

  useEffect(() => {
    tryBiometric();
    // Only attempt automatically once, when the lock screen first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDigit(digit: string) {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError(false);

    if (next.length === PIN_LENGTH) {
      const valid = await verifyPin(next);
      if (valid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onUnlock();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        setTimeout(() => setPin(''), 400);
      }
    }
  }

  function handleBackspace() {
    setError(false);
    setPin((current) => current.slice(0, -1));
  }

  return (
    <View style={[styles.overlay, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        {onCancel && (
          <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelButton}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Cancel
            </ThemedText>
          </Pressable>
        )}
        <View style={styles.header}>
          <ThemedText type="title">Loan Wise</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {error ? 'Incorrect PIN, try again' : 'Enter your PIN to unlock'}
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
              size={22}
            />
          }
          leadingAccessory={
            biometricsAvailable ? (
              <Pressable onPress={tryBiometric} hitSlop={8}>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'faceid', android: 'fingerprint', web: 'fingerprint' }}
                  size={26}
                />
              </Pressable>
            ) : undefined
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  cancelButton: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
  },
});
