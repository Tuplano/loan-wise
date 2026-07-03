import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { LockScreen } from '@/components/lock-screen';
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

  return (
    <>
      {children}
      {settingsLoaded && appLockEnabled && locked && (
        <LockScreen onUnlock={() => setLocked(false)} />
      )}
    </>
  );
}
