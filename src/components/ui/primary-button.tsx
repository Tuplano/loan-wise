import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: 'regular' | 'large';
};

export function PrimaryButton({ label, onPress, disabled, size = 'regular' }: PrimaryButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [pressed && !disabled && styles.pressed]}>
      <View
        style={[
          styles.button,
          size === 'large' ? styles.large : styles.regular,
          { backgroundColor: theme.primary },
          disabled && styles.disabled,
        ]}>
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  button: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.input,
    shadowColor: '#0B5D42',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  regular: {
    height: 44,
  },
  large: {
    height: 50,
    borderRadius: Radii.input + 2,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
