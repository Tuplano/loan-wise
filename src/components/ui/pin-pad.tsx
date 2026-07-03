import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

const KEY_GAP = Spacing.four + 8;
const MIN_KEY_SIZE = 64;
const MAX_KEY_SIZE = 92;

type PinPadProps = {
  length: number;
  filled: number;
  error?: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** Rendered in place of the empty key to the left of "0" (e.g. a biometric button). */
  leadingAccessory?: React.ReactNode;
  backspaceIcon: React.ReactNode;
};

export function PinPad({ length, filled, error, onDigit, onBackspace, leadingAccessory, backspaceIcon }: PinPadProps) {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  // Keep the gap between keys fixed and let the key size adapt to whatever room is left,
  // so the layout never looks cramped regardless of the device's screen width.
  const keySize =
    containerWidth > 0
      ? Math.min(MAX_KEY_SIZE, Math.max(MIN_KEY_SIZE, (containerWidth - KEY_GAP * 2) / 3))
      : MAX_KEY_SIZE;
  const keyStyle = { width: keySize, height: keySize };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.dotsRow}>
        {Array.from({ length }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                borderColor: error ? theme.danger : theme.border,
                backgroundColor: index < filled ? (error ? theme.danger : theme.primary) : 'transparent',
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {KEYPAD_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((digit) => (
              <KeypadButton key={digit} label={digit} onPress={() => onDigit(digit)} size={keySize} />
            ))}
          </View>
        ))}
        <View style={styles.keypadRow}>
          <View style={[styles.keypadKey, keyStyle]}>{leadingAccessory}</View>
          <KeypadButton label="0" onPress={() => onDigit('0')} size={keySize} />
          <Pressable onPress={onBackspace} style={[styles.keypadKey, keyStyle]}>
            {backspaceIcon}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function KeypadButton({ label, onPress, size }: { label: string; onPress: () => void; size: number }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.keypadKey,
        { width: size, height: size },
        pressed && { backgroundColor: theme.backgroundElement },
      ]}>
      <ThemedText style={[styles.keypadLabel, { fontSize: size * 0.46, lineHeight: size * 0.5 }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three + 6,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  keypad: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four + 4,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: KEY_GAP,
  },
  keypadKey: {
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadLabel: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
