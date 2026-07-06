import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'regular' | 'large';
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  size = 'regular',
}: PrimaryButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isInactive = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (isInactive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isInactive}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 100 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150 });
      }}>
      <Animated.View
        style={[
          styles.button,
          size === 'large' ? styles.large : styles.regular,
          { backgroundColor: theme.primary },
          isInactive && styles.disabled,
          animatedStyle,
        ]}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText type="smallBold" style={styles.label}>
            {label}
          </ThemedText>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.input,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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
