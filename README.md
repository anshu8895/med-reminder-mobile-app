# 💊 Medicine Reminder

A React Native (Expo) app for scheduling and tracking daily medication. Built with Expo SDK 54, expo-router, and expo-notifications.

---

## Features

- **Daily reminders** — Schedule 1, 2, or 3 doses per medicine with a time picker
- **Interactive notifications** — Mark as Taken or Snooze (10 min) directly from the notification shade, no app open required
- **Real-time home screen** — Taken / Missed / Snoozed badges per dose, live progress card, optimistic UI with rollback
- **Full history** — Dose log grouped by date (Today / Yesterday / full date), with per-entry dose number
- **Battery optimization prompt** — One-time guide on Android to exempt the app from Samsung / OEM battery optimization that delays alarms
- **Safe delete** — Removing a medicine also cancels its notifications, clears its snooze state, and purges its taken logs

---

## Project Structure

```
app/
  _layout.tsx          # Root layout: foreground notification handler, cold-start handler, battery prompt
  (tabs)/
    index.tsx          # Home screen: medicine cards, dose rows, progress
    add-medicine.tsx   # Add form (name, frequency 1–3x, time picker)
    edit-medicine.tsx  # Edit form (same as add with no-change guard)
    history.tsx        # Taken-log viewer (SectionList, summary strip)

lib/
  storage.ts           # ALL data + notification logic (AsyncStorage, Expo Notifications)
  events.ts            # Minimal pub/sub for cross-component refresh

constants/
  medicine.ts          # Shared types: Medicine, DoseTime, TakenLog
```

---

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Expo SDK | 54 | Managed workflow, OTA updates |
| expo-router | 4.x | File-based navigation |
| expo-notifications | 0.32 | Local push notifications |
| @react-native-async-storage | 2.x | Persistent local storage |
| @react-native-community/datetimepicker | — | Native time picker (iOS + Android) |
| react-native-safe-area-context | — | Safe area insets |
| EAS Build / Update | — | APK builds + OTA delivery |

---

## Getting Started

### Prerequisites

- Node 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android Studio (emulator) or a physical Android device with USB debugging

### Install

```bash
npm install
```

### Run (dev client)

```bash
npx expo start --dev-client --clear
```

Connect your device or emulator. Tap **Open** in the Expo Dev Launcher.

---

## Building

### Preview APK (installable on Android)

```bash
eas build --platform android --profile preview
```

### OTA Update (JS-only changes, no rebuild needed)

```bash
eas update --branch preview --message "your message"
```

---

## Notification Architecture

### Daily Reminders
One `DAILY` trigger per dose-time per medicine. Scheduled atomically — `saveMedicines` cancels all existing notifications and reschedules everything in one pass via `rescheduleAllNotifications()`.

### Interactive Buttons
Notifications include **Mark as Taken** and **Snooze 10 min** action buttons registered via `MEDICINE_REMINDER` category. Handled in `_layout.tsx` by `handleNotificationAction`.

### Deduplication
- **Rapid taps:** `addTakenLogIfNotExists` is idempotent — checks storage before writing
- **Cold-start replay:** `LAST_HANDLED_NOTIF_ID` persisted in AsyncStorage prevents replaying the same notification action on every app restart

### Android Exact Alarms
`SCHEDULE_EXACT_ALARM` permission is declared via the `expo-notifications` plugin in `app.json`. Without this, Android 12+ batches `DAILY` triggers.

### Samsung / OEM Battery Optimization
On first launch, the app shows a one-time alert guiding users to mark the app as **Unrestricted** in battery settings. Samsung One UI (and other OEMs) batch alarms even with exact-alarm permission unless the app is excluded.

---

## Data Model

```typescript
type DoseTime = { hour: number; minute: number };

type Medicine = {
  id: string;          // Date.now().toString()
  name: string;
  times: DoseTime[];   // 1–3 entries, always sorted ascending
};

type TakenLog = {
  id: string;
  medicineId: string;
  medicineName: string;
  timeIndex: number;   // 0-based dose slot
  takenAt: string;     // ISO 8601
};
```

### AsyncStorage Keys

| Key | Contents |
|-----|---------|
| `med_reminders` | `Medicine[]` |
| `med_taken_logs` | `TakenLog[]` |
| `med_snooze_state` | `{ doseKey, snoozeUntil }[]` |
| `med_snooze_notif_ids` | `{ doseKey, notificationId }[]` |
| `last_handled_notif_id` | Cold-start dedup ID |
| `battery_opt_prompted` | `"true"` once shown |

---

## Known Limitations

- **Frequency capped at 3×/day** — Add support for custom times if needed
- **Notification timing on OEM Android** — Requires manual battery optimization exemption; no in-app request API in expo-notifications v0.32
- **History is all-time** — No per-day adherence % or weekly view yet
