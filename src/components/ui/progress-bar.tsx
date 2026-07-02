import { StyleSheet, View } from 'react-native';

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

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height, backgroundColor: trackColor ?? theme.divider },
      ]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped * 100}%`,
            borderRadius: height,
            backgroundColor: fillColor ?? theme.primary,
          },
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
