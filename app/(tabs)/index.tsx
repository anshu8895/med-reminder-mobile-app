import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DoseTime, Medicine } from "../../constants/medicine";
import { subscribeToHomeRefresh } from "../../lib/events";
import {
  addTakenLogIfNotExists,
  clearSnoozed,
  deleteMedicineAndLogs,
  doseKey,
  getActiveSnoozedDoseKeys,
  getMedicines,
  getTodayTakenDoseKeys,
} from "../../lib/storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function formatDisplayTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


/** A dose is "missed" if its scheduled time has already passed today and it hasn't been taken. */
function isDoseMissed(hour: number, minute: number): boolean {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() > hour * 60 + minute;
}

function timeSlotColor(hour: number) {
  if (hour < 12) return { border: "#f59e0b", badge: "#fffbeb", badgeText: "#92400e", label: "Morning" };
  if (hour < 17) return { border: "#2563eb", badge: "#eff6ff", badgeText: "#1e3a8a", label: "Afternoon" };
  return { border: "#7c3aed", badge: "#f5f3ff", badgeText: "#4c1d95", label: "Evening" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GreetingHeader() {
  return (
    <View style={styles.greetingRow}>
      <View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.greetingText}>{getGreeting()} </Text>
          <Ionicons name="hand-right" size={20} color="#f59e0b" />
        </View>
        <Text style={styles.dateText}>{formatDate()}</Text>
      </View>
      <View style={styles.pillIconBg}>
        <Ionicons name="medkit" size={22} color="#2563eb" />
      </View>
    </View>
  );
}

function ProgressCard({
  medicines,
  takenDoseKeys,
}: {
  medicines: Medicine[];
  takenDoseKeys: Set<string>;
}) {
  // Count only doses that belong to current medicines — immune to dirty/orphan storage keys
  const totalDoses = medicines.reduce((s, m) => s + (m.times?.length ?? 0), 0);
  const takenDoses = medicines.reduce((count, m) =>
    count + (m.times ?? []).filter((_, i) => takenDoseKeys.has(doseKey(m.id, i))).length,
    0
  );
  const pct = totalDoses === 0 ? 0 : Math.round((takenDoses / totalDoses) * 100);

  return (
    <View style={styles.progressCard}>
      <View style={styles.progressTextGroup}>
        <Text style={styles.progressTitle}>Today's Schedule</Text>
        <Text style={styles.progressSub}>
          {totalDoses === 0
            ? "No medicines added yet"
            : `${takenDoses} of ${totalDoses} dose${totalDoses > 1 ? "s" : ""} taken`}
        </Text>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
        </View>
      </View>
      <View style={styles.progressCircle}>
        <Text style={styles.progressPct}>{pct}%</Text>
        <Text style={styles.progressPctSub}>done</Text>
      </View>
    </View>
  );
}

// ─── Dose Row (one per time entry in a medicine) ──────────────────────────────

function DoseRow({
  dt,
  isTaken,
  isSnoozed,
  isMissed,
  onTake,
}: {
  dt: DoseTime;
  isTaken: boolean;
  isSnoozed: boolean;
  isMissed: boolean;
  onTake: () => void;
}) {
  const slot = timeSlotColor(dt.hour);
  return (
    <View style={styles.doseRow}>
      {/* Left: time badge + slot label (always visible) + snoozed/missed if applicable */}
      <View style={styles.doseLeft}>
        <View style={[styles.timeBadge, { backgroundColor: slot.badge }]}>
          <Ionicons name="time-outline" size={11} color={slot.badgeText} />
          <Text style={[styles.timeBadgeText, { color: slot.badgeText }]}>
            {formatDisplayTime(dt.hour, dt.minute)}
          </Text>
        </View>

        {/* Morning / Afternoon / Evening — always shown */}
        <View style={[styles.slotBadge, { backgroundColor: slot.badge }]}>
          <Text style={[styles.slotBadgeText, { color: slot.badgeText }]}>{slot.label}</Text>
        </View>

        {/* Missed indicator — shown when past scheduled time and not taken */}
        {isMissed && !isTaken && !isSnoozed && (
          <View style={styles.missedBadge}>
            <Ionicons name="alert-circle-outline" size={11} color="#b91c1c" />
            <Text style={styles.missedBadgeText}>Missed</Text>
          </View>
        )}

        {/* Snoozed indicator alongside the slot label */}
        {isSnoozed && !isTaken && (
          <View style={styles.snoozeBadge}>
            <Ionicons name="alarm-outline" size={11} color="#7c3aed" />
            <Text style={styles.snoozeBadgeText}>Snoozed</Text>
          </View>
        )}
        {/* Taken — on left with all other status badges */}
        {isTaken && (
          <View style={styles.takenBadge}>
            <Ionicons name="checkmark-circle" size={13} color="#065f46" />
            <Text style={styles.takenBadgeText}>Taken</Text>
          </View>
        )}
      </View>

      {/* Right: plain green ✓ button only when action is still available */}
      {!isTaken && (
        <Pressable
          style={({ pressed }) => [
            styles.doseCheckBtn,
            isMissed ? styles.doseCheckBtnMissed : styles.doseCheckBtnPending,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={onTake}
        >
          <Ionicons name="checkmark" size={14} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

// ─── Medicine Card ────────────────────────────────────────────────────────────

function MedicineCard({
  item,
  takenDoseKeys,
  snoozedDoseKeys,
  onTakeDose,
  onEdit,
  onDelete,
}: {
  item: Medicine;
  takenDoseKeys: Set<string>;
  snoozedDoseKeys: Set<string>;
  onTakeDose: (timeIndex: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const allTaken = item.times.every((_, i) => takenDoseKeys.has(doseKey(item.id, i)));
  // Disable edit if ANY dose has been taken today — editing times of an already-taken
  // dose would corrupt the taken log (stored by timeIndex) and confuse the history.
  const anyTaken = item.times.some((_, i) => takenDoseKeys.has(doseKey(item.id, i)));
  const primaryColor = allTaken ? "#10b981" : timeSlotColor(item.times[0]?.hour ?? 8).border;

  return (
    <View style={[styles.medicineCard, { borderLeftColor: primaryColor }]}>
      {/* Card header: name + edit/delete */}
      <View style={styles.cardHeader}>
        <Text
          style={[styles.medicineName, allTaken && styles.medicineNameTaken]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <View style={styles.cardActions}>
          <Pressable
            style={({ pressed }) => [
              styles.iconBtn,
              anyTaken ? styles.editBtnDisabled : styles.editBtn,
              { opacity: pressed && !anyTaken ? 0.7 : 1 },
            ]}
            onPress={anyTaken ? undefined : onEdit}
            disabled={anyTaken}
          >
            <Ionicons name="pencil" size={14} color={anyTaken ? "#9ca3af" : "#fff"} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, styles.deleteBtn, { opacity: pressed ? 0.7 : 1 }]}
            onPress={onDelete}
          >
            <Ionicons name="trash" size={14} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Per-dose rows */}
      <View style={styles.doseList}>
        {item.times.map((dt, i) => (
          <View key={`${dt.hour}:${dt.minute}`}>
            <DoseRow
              dt={dt}
              isTaken={takenDoseKeys.has(doseKey(item.id, i))}
              isSnoozed={snoozedDoseKeys.has(doseKey(item.id, i))}
              isMissed={isDoseMissed(dt.hour, dt.minute)}
              onTake={() => onTakeDose(i)}
            />
            {i < item.times.length - 1 && <View style={styles.doseDivider} />}
          </View>
        ))}
      </View>

      {/* All-done banner */}
      {allTaken && (
        <View style={styles.allDoneBanner}>
          <Ionicons name="checkmark-circle" size={13} color="#065f46" />
          <Text style={styles.allDoneText}>All doses taken</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  // Composite keys: "medicineId-timeIndex" for taken and snoozed state
  const [takenDoseKeys, setTakenDoseKeys] = useState<Set<string>>(new Set());
  const [snoozedDoseKeys, setSnoozedDoseKeys] = useState<Set<string>>(new Set());

  // Load all state on tab focus
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [data, taken, snoozed] = await Promise.all([
          getMedicines(),
          getTodayTakenDoseKeys(),
          getActiveSnoozedDoseKeys(),
        ]);
        if (active) {
          setMedicines(data);
          setTakenDoseKeys(taken);
          setSnoozedDoseKeys(snoozed);
        }
      })();
      return () => { active = false; };
    }, [])
  );

  // Event bus: refresh after notification action completes
  useEffect(() => {
    return subscribeToHomeRefresh(async () => {
      const [data, taken, snoozed] = await Promise.all([
        getMedicines(),
        getTodayTakenDoseKeys(),
        getActiveSnoozedDoseKeys(),
      ]);
      setMedicines(data);
      setTakenDoseKeys(taken);
      setSnoozedDoseKeys(snoozed);
    });
  }, []);

  // Mark a single dose as taken — optimistic update with rollback on failure
  const handleTakeDose = async (med: Medicine, timeIndex: number) => {
    const key = doseKey(med.id, timeIndex);

    // Snapshot current state for rollback
    const prevTaken = new Set(takenDoseKeys);
    const prevSnoozed = new Set(snoozedDoseKeys);

    // Optimistic update for instant feedback
    setTakenDoseKeys((prev) => new Set([...prev, key]));
    setSnoozedDoseKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });

    try {
      await addTakenLogIfNotExists({
        medicineId: med.id,
        medicineName: med.name,
        timeIndex,
        takenAt: new Date().toISOString(),
      });
      await clearSnoozed(med.id, timeIndex);
    } catch {
      // Rollback UI to previous state if persistence failed
      setTakenDoseKeys(prevTaken);
      setSnoozedDoseKeys(prevSnoozed);
      Alert.alert("Error", "Failed to mark dose as taken. Please try again.");
    }
  };

  // Delete medicine AND purge its taken logs to prevent orphan history entries
  const deleteMedicine = async (id: string) => {
    // Snapshot all three slices for direct rollback (no refetch flicker)
    const prevMedicines = medicines;
    const prevTaken = new Set(takenDoseKeys);
    const prevSnoozed = new Set(snoozedDoseKeys);

    const filterKeys = (s: Set<string>) => {
      const next = new Set(s);
      [...next].filter((k) => k.startsWith(`${id}-`)).forEach((k) => next.delete(k));
      return next;
    };

    // Optimistic: remove medicine + all its dose keys from UI immediately
    setMedicines((prev) => prev.filter((m) => m.id !== id));
    setTakenDoseKeys(filterKeys(takenDoseKeys));
    setSnoozedDoseKeys(filterKeys(snoozedDoseKeys));

    try {
      await deleteMedicineAndLogs(id);
    } catch {
      // Rollback directly — no refetch needed
      setMedicines(prevMedicines);
      setTakenDoseKeys(prevTaken);
      setSnoozedDoseKeys(prevSnoozed);
      Alert.alert("Error", "Failed to delete medicine. Please try again.");
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert("Delete medicine?", "This will remove the reminder.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMedicine(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <FlatList
        data={medicines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <GreetingHeader />
            <ProgressCard medicines={medicines} takenDoseKeys={takenDoseKeys} />
            {medicines.length > 0 && (
              <Text style={styles.sectionLabel}>
                {medicines.length} Reminder{medicines.length > 1 ? "s" : ""}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="medkit-outline" size={52} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No medicines yet</Text>
            <Text style={styles.emptySub}>Tap + to add your first reminder</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MedicineCard
            item={item}
            takenDoseKeys={takenDoseKeys}
            snoozedDoseKeys={snoozedDoseKeys}
            onTakeDose={(timeIndex) => handleTakeDose(item, timeIndex)}
            onEdit={() => router.push(`/(tabs)/edit-medicine?id=${item.id}`)}
            onDelete={() => confirmDelete(item.id)}
          />
        )}
      />

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
        onPress={() => router.push("/add-medicine")}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f5f5" },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },

  // Greeting
  greetingRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 16,
  },
  greetingText: { fontSize: 22, fontWeight: "700", color: "#1f2937" },
  dateText: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  pillIconBg: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center",
  },

  // Progress card
  progressCard: {
    backgroundColor: "#2563eb", borderRadius: 16, padding: 18,
    flexDirection: "row", alignItems: "center", marginBottom: 22,
    shadowColor: "#2563eb", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  progressTextGroup: { flex: 1, marginRight: 16 },
  progressTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 4 },
  progressSub: { fontSize: 13, color: "#bfdbfe", marginBottom: 12 },
  progressBarTrack: { height: 6, backgroundColor: "#1d4ed8", borderRadius: 3, overflow: "hidden" },
  progressBarFill: { height: 6, backgroundColor: "#fff", borderRadius: 3 },
  progressCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  progressPct: { fontSize: 18, fontWeight: "800", color: "#fff" },
  progressPctSub: { fontSize: 10, color: "#bfdbfe" },

  // Section label
  sectionLabel: {
    fontSize: 13, fontWeight: "600", color: "#9ca3af",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10,
  },

  // Medicine card
  medicineCard: {
    backgroundColor: "#fff", borderRadius: 14, borderLeftWidth: 4,
    marginBottom: 10, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 5, elevation: 3,
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 10,
  },
  medicineName: {
    flex: 1, fontSize: 16, fontWeight: "600",
    color: "#1f2937", marginRight: 10,
  },
  medicineNameTaken: { textDecorationLine: "line-through", color: "#6b7280" },
  cardActions: { flexDirection: "row", gap: 6 },

  // Per-dose rows
  doseList: { gap: 2 },
  doseRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 5,
  },
  doseLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  doseDivider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 1 },

  // All-done banner
  allDoneBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: "#d1fae5",
  },
  allDoneText: { fontSize: 12, fontWeight: "600", color: "#065f46" },

  // Badges
  timeBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
  },
  timeBadgeText: { fontSize: 11, fontWeight: "600" },
  slotBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  slotBadgeText: { fontSize: 11, fontWeight: "600" },
  takenBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
    backgroundColor: "#d1fae5",
  },
  takenBadgeText: { fontSize: 11, fontWeight: "600", color: "#065f46" },
  missedBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
    backgroundColor: "#fef2f2",
  },
  missedBadgeText: { fontSize: 11, fontWeight: "600", color: "#b91c1c" },
  snoozeBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
    backgroundColor: "#f5f3ff",
  },
  snoozeBadgeText: { fontSize: 11, fontWeight: "600", color: "#7c3aed" },

  // Per-dose ✓ button
  doseCheckBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  doseCheckBtnPending: { backgroundColor: "#10b981" },
  doseCheckBtnMissed: { backgroundColor: "#ef4444" },

  // Card-level icon buttons (edit, delete)
  iconBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  editBtn: { backgroundColor: "#2563eb" },
  editBtnDisabled: { backgroundColor: "#bfdbfe" },
  deleteBtn: { backgroundColor: "#ef4444" },

  // Empty
  emptyBox: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#9ca3af" },
  emptySub: { fontSize: 14, color: "#9ca3af" },

  // FAB
  fab: {
    position: "absolute", bottom: 28, right: 20,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "#2563eb",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#2563eb", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
});
