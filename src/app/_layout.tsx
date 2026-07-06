import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppLockGate } from '@/components/app-lock-gate';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { seedAppSettings, seedDefaultCategories } from '@/db/seed';
import { refreshAllLoanStatuses } from '@/lib/loan-status';

import '@/global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { success, error } = useMigrations(db, migrations);
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const ready = success && fontsLoaded;

  useEffect(() => {
    if (success) {
      seedDefaultCategories();
      seedAppSettings();
      refreshAllLoanStatuses();
    }
  }, [success]);

  useEffect(() => {
    if (!success) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshAllLoanStatuses();
    });
    return () => subscription.remove();
  }, [success]);

  if (error) {
    throw error;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        {ready && (
          <AppLockGate>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="add-loan" options={{ presentation: 'modal', title: 'Add Loan' }} />
              <Stack.Screen name="loan/[id]/index" options={{ title: 'Loan' }} />
              <Stack.Screen name="loan/[id]/edit" options={{ title: 'Edit Loan' }} />
              <Stack.Screen name="categories" options={{ title: 'Categories' }} />
              <Stack.Screen name="payoff-planner" options={{ title: 'Payoff planner' }} />
              <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
            </Stack>
          </AppLockGate>
        )}
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
