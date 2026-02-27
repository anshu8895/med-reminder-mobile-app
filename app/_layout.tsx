import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { triggerHomeRefresh } from '../lib/events';
import {
  ACTION_MARK_TAKEN,
  ACTION_SNOOZE,
  SNOOZE_MINUTES,
  addTakenLogIfNotExists,
  clearSnoozed,
  isDoseTakenToday,
  scheduleSnoozeNotification,
  setSnoozed,
  setupNotificationCategories,
} from '../lib/storage';

// Persisted key for cold-start deduplication (see Bug 1 fix)
const LAST_HANDLED_NOTIF_ID = 'last_handled_notif_id';

export const unstable_settings = {
  anchor: '(tabs)',
};

async function handleNotificationAction(
  response: Notifications.NotificationResponse
) {
  const responseId = response.notification.request.identifier;
  const actionId = response.actionIdentifier;
  const data = response.notification.request.content.data as {
    medicineId?: string;
    medicineName?: string;
    timeIndex?: number;
  };

  const { medicineId, medicineName } = data || {};
  const timeIndex = data?.timeIndex ?? 0;
  if (!medicineId || !medicineName) return;

  // ── Bug 1 Fix: Cold-start deduplication ──────────────────────────────────────
  const lastHandled = await AsyncStorage.getItem(LAST_HANDLED_NOTIF_ID);
  if (lastHandled === responseId) return;
  await AsyncStorage.setItem(LAST_HANDLED_NOTIF_ID, responseId);
  // ─────────────────────────────────────────────────────────────────────────────

  try {
    if (actionId === ACTION_MARK_TAKEN) {
      await addTakenLogIfNotExists({
        medicineId,
        medicineName,
        timeIndex,
        takenAt: new Date().toISOString(),
      });
      await clearSnoozed(medicineId, timeIndex);

    } else if (actionId === ACTION_SNOOZE) {
      await setSnoozed(medicineId, timeIndex, SNOOZE_MINUTES);
      await scheduleSnoozeNotification(medicineId, medicineName, timeIndex);
    }
  } catch (err) {
    // Surface the error — was previously a silent unhandled rejection
    console.error('[handleNotificationAction] action failed:', err);
  }

  // Always run these — even if the action above failed
  triggerHomeRefresh();
  try {
    await Notifications.dismissNotificationAsync(responseId);
  } catch { /* may already be dismissed */ }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // ── Bug 3 Fix: Suppress foreground notifications for already-taken doses ────
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const d = notification.request.content.data as {
          medicineId?: string;
          timeIndex?: number;
        };
        if (d?.medicineId && d?.timeIndex !== undefined) {
          const alreadyTaken = await isDoseTakenToday(d.medicineId, d.timeIndex);
          if (alreadyTaken) {
            return {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          }
        }
        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });
    // ─────────────────────────────────────────────────────────────────────────────

    // Live events (app already running in foreground)
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => { await handleNotificationAction(response); }
    );

    // ❄️ Cold start + async setup
    (async () => {
      // Register action button categories — awaited so failures surface
      await setupNotificationCategories();

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        await handleNotificationAction(lastResponse);
      }

      // ── Battery optimisation prompt (Android / Samsung) ──────────────────────
      if (Platform.OS === 'android') {
        const prompted = await AsyncStorage.getItem('battery_opt_prompted');
        if (!prompted) {
          await AsyncStorage.setItem('battery_opt_prompted', 'true');
          Alert.alert(
            '⏰ Enable Reliable Reminders',
            'For on-time notifications on Samsung and other Android devices, please disable battery optimization for this app.\n\nTap "Open Settings" → Battery → Unrestricted (or "Don\'t optimise").',
            [
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
              { text: 'Later', style: 'cancel' },
            ]
          );
        }
      }
      // ─────────────────────────────────────────────────────────────────────────
    })();

    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
