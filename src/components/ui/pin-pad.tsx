import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

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

  return (
    <View style={styles.container}>
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
              <KeypadButton key={digit} label={digit} onPress={() => onDigit(digit)} />
            ))}
          </View>
        ))}
        <View style={styles.keypadRow}>
          <View style={styles.keypadKey}>{leadingAccessory}</View>
          <KeypadButton label="0" onPress={() => onDigit('0')} />
          <Pressable onPress={onBackspace} style={styles.keypadKey}>
            {backspaceIcon}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function KeypadButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.keypadKey, pressed && { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.keypadLabel}>{label}</ThemedText>
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
    gap: Spacing.three,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  keypad: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  keypadKey: {
    width: 72,
    height: 72,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadLabel: {
    fontSize: 26,
    lineHeight: 30,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
