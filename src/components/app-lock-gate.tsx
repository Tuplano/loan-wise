import { useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';

import { LockScreen } from '@/components/lock-screen';
import { ThemedView } from '@/components/themed-view';
import { useAppSettings } from '@/hooks/use-app-settings';

type AppLockGateProps = {
  children: React.ReactNode;
};

export function AppLockGate({ children }: AppLockGateProps) {
  const settings = useAppSettings();
  const settingsLoaded = settings !== undefined;
  const appLockEnabled = settings?.appLockEnabled ?? false;

  // Fail-secure: assume locked until settings confirm otherwise.
  const [locked, setLocked] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Once settings load for the first time, snap `locked` to the persisted setting.
  if (settingsLoaded && !initialized) {
    setInitialized(true);
    setLocked(appLockEnabled);
  }

  useEffect(() => {
    if (!appLockEnabled) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') setLocked(true);
    });
    return () => subscription.remove();
  }, [appLockEnabled]);

  // Settings (and therefore whether app lock is even on) haven't loaded yet — render a blank
  // frame instead of `children`, so a locked user never gets a glimpse of the dashboard
  // underneath before the lock screen has a chance to mount.
  if (!settingsLoaded) {
    return <ThemedView style={styles.blank} />;
  }

  return (
    <>
      {children}
      {appLockEnabled && locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </>
  );
}

const styles = StyleSheet.create({
  blank: {
    flex: 1,
  },
});
