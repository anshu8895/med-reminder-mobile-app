import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdherenceDashboard } from "../../components/explore/AdherenceDashboard";
import {
  computeMissRisk,
  computeReliability,
  computeStreakFromLogs,
  localDateKey,
  localDayStart,
  medExistedOn,
} from "../../components/explore/adherenceHelpers";
import { CelebrationCard } from "../../components/explore/CelebrationCard";
import { HealthTipCard } from "../../components/explore/HealthTipCard";
import { QuickActionsGrid } from "../../components/explore/QuickActionsGrid";
import { ReliabilityCard } from "../../components/explore/ReliabilityCard";
import { SearchBar, SearchResults } from "../../components/explore/SearchBar";
import { HEALTH_TIPS, MedReliability, MissRisk } from "../../components/explore/types";
import { Medicine } from "../../constants/medicine";
import { getMedicines, getTakenLogs } from "../../lib/storage";

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [dailyData, setDailyData] = useState<("perfect" | "missed" | "empty")[]>([]);
  const [streak, setStreak] = useState(0);
  const [missRisk, setMissRisk] = useState<MissRisk | null>(null);
  const [weekTakenCount, setWeekTakenCount] = useState(0);
  const [weekTotalCount, setWeekTotalCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [reliability, setReliability] = useState<MedReliability[]>([]);


  const loadAdherence = useCallback(async () => {
    try {
      const [meds, logs] = await Promise.all([getMedicines(), getTakenLogs()]);

      // ── Two-level pre-index ──────────────────────────────────────────────
      const medDayIndex = new Map<string, Map<string, number>>();
      const logSet = new Set<string>();

      for (const log of logs) {
        const key = localDateKey(new Date(log.takenAt));
        if (!medDayIndex.has(log.medicineId)) medDayIndex.set(log.medicineId, new Map());
        const dayMap = medDayIndex.get(log.medicineId)!;
        dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
        logSet.add(`${log.medicineId}-${log.timeIndex}-${key}`);
      }

      // ── Today ────────────────────────────────────────────────────────────
      const todayKey = localDateKey(localDayStart(0));
      const todayExpected = meds.reduce((sum, m) => sum + (m.times?.length ?? 0), 0);
      const todayTaken = meds.reduce(
        (sum, m) => sum + (medDayIndex.get(m.id)?.get(todayKey) ?? 0),
        0
      );
      const isTodayComplete = todayExpected > 0 && todayTaken >= todayExpected;

      // ── 30-day daily data ─────────────────────────────────────────────────
      let weekTaken = 0;
      let weekTotal = 0;
      const dailyDataArr = Array.from({ length: 30 }, (_, i) => {
        const dayStart = localDayStart(29 - i);
        const dayKey = localDateKey(dayStart);
        const existingMeds = meds.filter((m) => medExistedOn(m.createdAt, dayStart));
        const expectedOnDay = existingMeds.reduce((sum, m) => sum + (m.times?.length ?? 0), 0);
        const takenOnDay = existingMeds.reduce(
          (sum, m) => sum + (medDayIndex.get(m.id)?.get(dayKey) ?? 0),
          0
        );
        if (i >= 23) {
          weekTaken += Math.min(takenOnDay, expectedOnDay);
          weekTotal += expectedOnDay;
        }
        if (expectedOnDay === 0) return "empty";
        return takenOnDay >= expectedOnDay ? "perfect" : "missed";
      });

      // ── Celebration — show whenever today is 100% complete ────────────────
      setShowCelebration(isTodayComplete);

      setMedicines(meds);
      setDailyData(dailyDataArr);
      setStreak(computeStreakFromLogs(medDayIndex, meds, isTodayComplete));
      setMissRisk(computeMissRisk(logSet, meds));
      setWeekTakenCount(weekTaken);
      setWeekTotalCount(weekTotal);
      setReliability(computeReliability(logSet, medDayIndex, meds));
    } catch (e) {
      console.warn("[ExploreScreen] Failed to load adherence data:", e);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadAdherence(); }, [loadAdherence]));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Explore</Text>

        <SearchBar query={searchQuery} onChangeQuery={setSearchQuery} />
        <SearchResults query={searchQuery} medicines={medicines} tips={HEALTH_TIPS} />

        {showCelebration && <CelebrationCard onDismiss={() => setShowCelebration(false)} />}

        <AdherenceDashboard
          dailyData={dailyData}
          streak={streak}
          missRisk={missRisk}
          weekTakenCount={weekTakenCount}
          weekTotalCount={weekTotalCount}
        />

        <ReliabilityCard data={reliability} />

        <QuickActionsGrid />

        <Text style={styles.sectionTitle}>Health Tips</Text>
        {HEALTH_TIPS.map((tip, i) => (
          <View key={i} style={i < HEALTH_TIPS.length - 1 ? { marginBottom: 12 } : {}}>
            <HealthTipCard tip={tip} />
          </View>
        ))}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f5f5" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  screenTitle: { fontSize: 28, fontWeight: "700", color: "#1f2937", marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1f2937", marginBottom: 12 },
  bottomSpacer: { height: 32 },
});
