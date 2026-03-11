import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";
import { Medicine, TakenLog } from "../constants/medicine";

const KEY = "med_reminders";
const LOGS_KEY = "med_taken_logs";
const SNOOZE_STATE_KEY = "med_snooze_state";
// Maps doseKey → scheduled notification ID, so we can cancel before re-scheduling
const SNOOZE_NOTIF_IDS_KEY = "med_snooze_notif_ids";
const INSTALL_DATE_KEY = "med_install_date";

// ─── Snooze State ─────────────────────────────────────────────────────────────
// Snooze is tracked per-dose using a composite key: `${medicineId}-${timeIndex}`

type SnoozeEntry = { doseKey: string; snoozeUntil: string; };

export function doseKey(medicineId: string, timeIndex: number): string {
  return `${medicineId}-${timeIndex}`;
}

/**
 * Returns the stored app install date, creating it on first call.
 * Used as the conservative createdAt fallback during migration so that medicines
 * with no logs don't silently lose the period between install and migration.
 */
export async function getOrSetInstallDate(): Promise<string> {
  const stored = await AsyncStorage.getItem(INSTALL_DATE_KEY);
  if (stored) return stored;
  const now = new Date().toISOString();
  await AsyncStorage.setItem(INSTALL_DATE_KEY, now);
  return now;
}

/** Mark a specific dose as snoozed for N minutes from now. */
export async function setSnoozed(
  medicineId: string,
  timeIndex: number,
  minutes: number
): Promise<void> {
  const key = doseKey(medicineId, timeIndex);
  const raw = await AsyncStorage.getItem(SNOOZE_STATE_KEY);
  const entries: SnoozeEntry[] = raw ? JSON.parse(raw) : [];
  const filtered = entries.filter((e) => e.doseKey !== key);
  const snoozeUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  filtered.push({ doseKey: key, snoozeUntil });
  await AsyncStorage.setItem(SNOOZE_STATE_KEY, JSON.stringify(filtered));
}

/** Returns a Set of doseKeys (`${medicineId}-${timeIndex}`) whose snooze is active.
 *  Prunes expired entries from storage as a side-effect (keeps AsyncStorage clean). */
export async function getActiveSnoozedDoseKeys(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SNOOZE_STATE_KEY);
  const entries: SnoozeEntry[] = raw ? JSON.parse(raw) : [];
  const now = Date.now();
  const valid = entries.filter((e) => e.doseKey && new Date(e.snoozeUntil).getTime() > now);
  // Write back only the non-expired entries — fire-and-forget, doesn't block return
  if (valid.length !== entries.length) {
    AsyncStorage.setItem(SNOOZE_STATE_KEY, JSON.stringify(valid)).catch(() => { });
  }
  return new Set(valid.map((e) => e.doseKey));
}

/** Remove snooze for a specific dose (call when that dose is marked as taken). */
export async function clearSnoozed(
  medicineId: string,
  timeIndex: number
): Promise<void> {
  const key = doseKey(medicineId, timeIndex);

  // Cancel the OS-scheduled snooze notification for this dose (best-effort)
  try {
    const idsRaw = await AsyncStorage.getItem(SNOOZE_NOTIF_IDS_KEY);
    const idEntries: SnoozeNotifEntry[] = idsRaw ? JSON.parse(idsRaw) : [];
    const existing = idEntries.find((e) => e.doseKey === key);
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing.notificationId);
      await AsyncStorage.setItem(
        SNOOZE_NOTIF_IDS_KEY,
        JSON.stringify(idEntries.filter((e) => e.doseKey !== key))
      );
    }
  } catch { /* already fired or never scheduled – safe to ignore */ }

  // Remove snooze-active entry
  const raw = await AsyncStorage.getItem(SNOOZE_STATE_KEY);
  const entries: SnoozeEntry[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(
    SNOOZE_STATE_KEY,
    JSON.stringify(entries.filter((e) => e.doseKey && e.doseKey !== key))
  );
}

// ─── Notification categories (action buttons) ────────────────────────────────

export const CATEGORY_ID = "MEDICINE_REMINDER";
export const ACTION_MARK_TAKEN = "mark-taken";
export const ACTION_SNOOZE = "snooze";
export const SNOOZE_MINUTES = 10;

/** Call once on app startup to register interactive notification buttons. */
export async function setupNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: ACTION_MARK_TAKEN,
      buttonTitle: "✓ Mark as Taken",
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: `⏰ Snooze ${SNOOZE_MINUTES} min`,
      options: { opensAppToForeground: true },
    },
  ]);
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
}

// ─── Medicines ────────────────────────────────────────────────────────────────

export async function getMedicines(): Promise<Medicine[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed: any[] = JSON.parse(raw);

  let needsResave = false;

  // Pre-read logs only when any record is missing createdAt (one-time migration cost)
  const needsCreatedAt = parsed.some((m) => !m.createdAt);
  let logsForMigration: TakenLog[] = [];
  let installDateForMigration = new Date().toISOString(); // safe default
  if (needsCreatedAt) {
    const logsRaw = await AsyncStorage.getItem(LOGS_KEY);
    logsForMigration = logsRaw ? JSON.parse(logsRaw) : [];
    // Use stored install date so medicines with no logs don't lose pre-migration history
    installDateForMigration = await getOrSetInstallDate();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const migrated: Medicine[] = parsed.map((m: any) => {
    let result = { ...m };

    // Migration 1: times[] (pre-frequency-feature records had hour/minute flat)
    if (!result.times) {
      needsResave = true;
      result = { ...result, times: [{ hour: result.hour ?? 8, minute: result.minute ?? 0 }] };
    } else if (!Array.isArray(result.times) || result.times.length === 0) {
      needsResave = true;
      result = { ...result, times: [{ hour: 8, minute: 0 }] };
    }

    // Migration 2: createdAt — use earliest log date; fall back to today
    if (!result.createdAt) {
      needsResave = true;
      const medLogs = logsForMigration.filter((l) => l.medicineId === result.id);
      if (medLogs.length > 0) {
        const earliest = medLogs.reduce<string>(
          (min, l) => (l.takenAt < min ? l.takenAt : min),
          medLogs[0].takenAt
        );
        result = { ...result, createdAt: earliest };
      } else {
        result = { ...result, createdAt: installDateForMigration };
      }
    }

    return result as Medicine;
  });

  if (needsResave) {
    await AsyncStorage.setItem(KEY, JSON.stringify(migrated));
  }

  return migrated;
}

/**
 * Cancel every scheduled notification and re-schedule one DAILY notification
 * per dose-time for each medicine in `medicines`.
 *
 * Extracted into a single function because scheduling logic is high-risk:
 * if it lives in two places a future change will inevitably only update one.
 * Called by saveMedicines (add/edit) and deleteMedicineAndLogs (delete).
 */
async function rescheduleAllNotifications(medicines: Medicine[]): Promise<void> {
  // Cancel all notifications and wipe snooze metadata.
  // Snooze IDs and state must be cleared together with the notification cancel;
  // otherwise clearSnoozed() would try to cancel already-gone notification IDs.
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(SNOOZE_NOTIF_IDS_KEY);
  await AsyncStorage.removeItem(SNOOZE_STATE_KEY);

  for (const med of medicines) {
    for (let i = 0; i < med.times.length; i++) {
      const { hour, minute } = med.times[i];
      const trigger: Notifications.DailyTriggerInput | Notifications.CalendarTriggerInput =
        Platform.OS === "android"
          ? { type: SchedulableTriggerInputTypes.DAILY, hour, minute }
          : { type: SchedulableTriggerInputTypes.CALENDAR, repeats: true, hour, minute };
      const doseLabel = med.times.length > 1 ? ` (Dose ${i + 1})` : "";
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💊 Medication Reminder",
          body: `Time to take your ${med.name}${doseLabel}`,
          sound: true,
          categoryIdentifier: CATEGORY_ID,
          data: { medicineId: med.id, medicineName: med.name, timeIndex: i },
        },
        trigger,
      });
    }
  }
}

/**
 * Persist medicines and reschedule ALL notifications.
 * Each medicine schedules one daily notification per dose time,
 * carrying { medicineId, medicineName, timeIndex } in the data payload.
 */
export async function saveMedicines(medicines: Medicine[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(medicines));
  await requestNotificationPermissions();
  await rescheduleAllNotifications(medicines);
}

/**
 * Schedule a one-off snooze notification N minutes from now.
 * Looks up totalDoses from storage so the label is always accurate,
 * even if the user edited the medicine's frequency since the original notification.
 */
// Tracks per-dose snooze notification IDs so old ones can be cancelled before rescheduling.
type SnoozeNotifEntry = { doseKey: string; notificationId: string; };

export async function scheduleSnoozeNotification(
  medicineId: string,
  medicineName: string,
  timeIndex: number
): Promise<void> {
  const key = doseKey(medicineId, timeIndex);

  // Cancel any existing snooze notification for this dose before scheduling a new one.
  // Prevents accumulation if handler is invoked more than once for the same action.
  try {
    const idsRaw = await AsyncStorage.getItem(SNOOZE_NOTIF_IDS_KEY);
    const idEntries: SnoozeNotifEntry[] = idsRaw ? JSON.parse(idsRaw) : [];
    const existing = idEntries.find((e) => e.doseKey === key);
    if (existing) {
      await Notifications.cancelScheduledNotificationAsync(existing.notificationId);
    }
  } catch { /* already fired – fine */ }

  // Derive label from current storage — never from stale notification data
  const medicines = await getMedicines();
  const med = medicines.find((m) => m.id === medicineId);
  const totalDoses = med?.times.length ?? 1;
  const doseLabel = totalDoses > 1 ? ` (Dose ${timeIndex + 1})` : "";

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "💊 Snoozed Reminder",
      body: `Don't forget to take your ${medicineName}${doseLabel}`,
      sound: true,
      categoryIdentifier: CATEGORY_ID,
      data: { medicineId, medicineName, timeIndex },
    },
    // TIME_INTERVAL works without SCHEDULE_EXACT_ALARM permission (uses AlarmManager.set).
    // After rebuild with androidMode:"exact", this becomes a precise exact alarm automatically.
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: SNOOZE_MINUTES * 60,
      repeats: false,
    },
  });

  // Persist the new notification ID for this dose
  try {
    const idsRaw = await AsyncStorage.getItem(SNOOZE_NOTIF_IDS_KEY);
    const idEntries: SnoozeNotifEntry[] = idsRaw ? JSON.parse(idsRaw) : [];
    const filtered = idEntries.filter((e) => e.doseKey !== key);
    filtered.push({ doseKey: key, notificationId });
    await AsyncStorage.setItem(SNOOZE_NOTIF_IDS_KEY, JSON.stringify(filtered));
  } catch { /* non-fatal */ }
}

// ─── Taken Log ────────────────────────────────────────────────────────────────

export async function getTakenLogs(): Promise<TakenLog[]> {
  const raw = await AsyncStorage.getItem(LOGS_KEY);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Internal only — do NOT call this directly.
 * Use addTakenLogIfNotExists to prevent duplicate log entries.
 */
async function _addTakenLog(log: Omit<TakenLog, "id">): Promise<void> {
  const existing = await getTakenLogs();
  const entry: TakenLog = { ...log, id: Date.now().toString() };
  await AsyncStorage.setItem(LOGS_KEY, JSON.stringify([...existing, entry]));
}

/**
 * The only public API for logging a taken dose.
 * No-ops if the dose is already logged today — prevents duplicates
 * from notification double-fires or rapid button taps.
 */
export async function addTakenLogIfNotExists(
  log: Omit<TakenLog, "id">
): Promise<void> {
  if (await isDoseTakenToday(log.medicineId, log.timeIndex)) return;
  await _addTakenLog(log);
}

/**
 * Returns a Set of dose keys (`"${medicineId}-${timeIndex}"`) taken today.
 * Use this to check per-dose taken state on the home screen.
 */
export async function getTodayTakenDoseKeys(): Promise<Set<string>> {
  const logs = await getTakenLogs();
  const todayStr = new Date().toDateString();
  const keys = logs
    .filter((l) => new Date(l.takenAt).toDateString() === todayStr)
    .map((l) => `${l.medicineId}-${l.timeIndex}`);
  return new Set(keys);
}

/**
 * Check if a specific dose has already been logged today.
 * Prevents duplicate entries from notification double-fires.
 */
export async function isDoseTakenToday(
  medicineId: string,
  timeIndex: number
): Promise<boolean> {
  const keys = await getTodayTakenDoseKeys();
  return keys.has(`${medicineId}-${timeIndex}`);
}



/** Clear ALL logs including today (full reset). */
export async function clearAllTakenLogs(): Promise<void> {
  await AsyncStorage.removeItem(LOGS_KEY);
}

/**
 * DEV UTILITY — Wipe all app data from AsyncStorage and cancel all notifications.
 * Use this once when migrating a breaking data-model change (e.g. hour/minute → times[]).
 * Do NOT call this in production flows.
 *
 * Order: cancel notifications FIRST (safe to repeat), then clear storage.
 * Caller must wrap in try/catch and reset in-memory UI state on success.
 */
export async function clearAllData(): Promise<void> {
  // 1. Cancel notifications first — idempotent and safe to do even if storage clear fails
  await Notifications.cancelAllScheduledNotificationsAsync();
  // 2. Clear storage keys sequentially so a failure leaves a known partial state
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(LOGS_KEY);
  await AsyncStorage.removeItem(SNOOZE_STATE_KEY);
  await AsyncStorage.removeItem(SNOOZE_NOTIF_IDS_KEY);
}

/**
 * Delete a medicine AND purge all its associated data:
 *   - Removes the medicine from storage
 *   - Removes all taken logs for that medicineId (prevents orphan history entries)
 *   - Removes any active snooze entries for that medicineId
 *   - Reschedules notifications for remaining medicines
 */
export async function deleteMedicineAndLogs(medicineId: string): Promise<void> {
  // 1. Core: remove medicine from storage — the ONLY step that can throw.
  //    If this fails, the caller rolls back the UI. If it succeeds, everything
  //    else is best-effort cleanup that must never surface a false error alert.
  const medicines = await getMedicines();
  const updated = medicines.filter((m) => m.id !== medicineId);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));

  // 2. Best-effort: resync notifications (permission denial on emulators is common)
  try {
    await requestNotificationPermissions();
    await rescheduleAllNotifications(updated);
  } catch (e) {
    console.error("[delete] notification resync failed (non-fatal):", e);
  }

  // 3. Best-effort: purge taken logs for this medicine
  try {
    const logs = await getTakenLogs();
    const prunedLogs = logs.filter((l) => l.medicineId !== medicineId);
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(prunedLogs));
  } catch (e) {
    console.error("[delete] log pruning failed (non-fatal):", e);
  }

  // 4. Best-effort: purge snooze entries for this medicine
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_STATE_KEY);
    const entries: SnoozeEntry[] = raw ? JSON.parse(raw) : [];
    const prunedSnooze = entries.filter((e) => e.doseKey && !e.doseKey.startsWith(`${medicineId}-`));
    await AsyncStorage.setItem(SNOOZE_STATE_KEY, JSON.stringify(prunedSnooze));
  } catch (e) {
    console.error("[delete] snooze pruning failed (non-fatal):", e);
  }
}

// ─── Celebration Persistence ──────────────────────────────────────────────────
// Key is scoped to the calendar date so the banner shows at most once per day,
// even if the user switches tabs or restarts the app.

function celebrationKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `med_celebrated_${y}-${m}-${day}`;
}

export async function getCelebrationShownToday(): Promise<boolean> {
  const val = await AsyncStorage.getItem(celebrationKey());
  return val === "1";
}

export async function setCelebrationShownToday(): Promise<void> {
  await AsyncStorage.setItem(celebrationKey(), "1");
}

