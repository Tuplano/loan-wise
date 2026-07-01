import Constants, { AppOwnership } from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

// expo-notifications reports a fatal error the instant it's touched in Expo Go on
// Android (SDK 53+ removed it there) — it bypasses try/catch entirely by reporting
// straight to the fatal error handler, not by throwing a catchable JS exception. The
// only reliable fix is to never require() the module at all in that environment.
const isExpoGoAndroid = Platform.OS === 'android' && Constants.appOwnership === AppOwnership.Expo;

let notificationsModule: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (isExpoGoAndroid) {
    notificationsModule = null;
    return notificationsModule;
  }
  try {
    notificationsModule = require('expo-notifications') as NotificationsModule;
  } catch (error) {
    console.warn('expo-notifications unavailable, reminders disabled:', error);
    notificationsModule = null;
  }
  return notificationsModule;
}

export function isNotificationsAvailable() {
  return getNotifications() !== null;
}

export async function ensureNotificationPermission() {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export async function cancelReminder(notificationId: string | null) {
  const Notifications = getNotifications();
  if (!Notifications || !notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

export async function scheduleLoanReminder(options: {
  loanName: string;
  amountLabel: string;
  dueDate: Date;
  daysBefore: number;
}) {
  const Notifications = getNotifications();
  if (!Notifications) return null;

  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  const triggerDate = new Date(options.dueDate);
  triggerDate.setDate(triggerDate.getDate() - options.daysBefore);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate.getTime() <= Date.now()) return null;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `${options.loanName} payment due soon`,
        body: `${options.amountLabel} due ${options.dueDate.toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
        })}`,
        sound: Platform.OS === 'android' ? undefined : true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch (error) {
    console.warn('Failed to schedule reminder:', error);
    return null;
  }
}
