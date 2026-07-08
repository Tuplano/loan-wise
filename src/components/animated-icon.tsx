import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

// The gif has 48 frames @ 50ms/frame; hold it on screen for one full loop before fading out.
const GIF_LOOP_DURATION = 48 * 50;
const FADE_DURATION = 350;

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!ready) return;
    opacity.value = withDelay(
      GIF_LOOP_DURATION,
      withTiming(0, { duration: FADE_DURATION }, (finished) => {
        if (finished) scheduleOnRN(setVisible, false);
      })
    );
  }, [ready]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.splashOverlay, animatedStyle]}>
      <Image
        style={styles.gif}
        source={require('@/assets/images/loan_wise_logo_animation.gif')}
        contentFit="contain"
        autoplay
        onLoadEnd={() => {
          SplashScreen.hideAsync().finally(() => setReady(true));
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#F3F6F2',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  gif: {
    width: '70%',
    aspectRatio: 1,
  },
});
