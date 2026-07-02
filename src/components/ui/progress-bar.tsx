import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

type ProgressBarProps = {
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
};

export function ProgressBar({ progress, height = 7, trackColor, fillColor }: ProgressBarProps) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const animatedProgress = useSharedValue(clamped);

  useEffect(() => {
    animatedProgress.value = withTiming(clamped, { duration: 500 });
  }, [clamped, animatedProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height, backgroundColor: trackColor ?? theme.divider },
      ]}>
      <Animated.View
        style={[
          styles.fill,
          {
            borderRadius: height,
            backgroundColor: fillColor ?? theme.primary,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
