import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ───────────────────────────────────────────────────────────────────

type QuickAction = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
};

type HealthTip = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

// ─── Static data ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  { id: "drug", label: "Drug\nInformation", icon: "medical", color: "#2563eb", bg: "#eff6ff" },
  { id: "interaction", label: "Interaction\nChecker", icon: "flask", color: "#7c3aed", bg: "#f5f3ff" },
  { id: "pharmacy", label: "Find\nPharmacy", icon: "location", color: "#059669", bg: "#ecfdf5" },
  { id: "emergency", label: "Emergency\nContacts", icon: "call", color: "#dc2626", bg: "#fef2f2" },
];

const HEALTH_TIP: HealthTip = {
  icon: "sunny",
  title: "Tip of the Day",
  body: "Take medications at the same time each day to build a habit. Setting a morning alarm is one of the most effective ways to improve adherence by up to 80%.",
};

// Weekly compliance data (Sun–Sat), true = taken, false = missed
const WEEKLY_DATA: boolean[] = [true, true, false, true, true, false, true];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SearchBar() {
  const [query, setQuery] = useState("");
  return (
    <View style={styles.searchWrapper}>
      <Ionicons name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search medications or tips…"
        placeholderTextColor="#9ca3af"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
      />
    </View>
  );
}

function AdherenceDashboard() {
  const taken = WEEKLY_DATA.filter(Boolean).length;
  const pct = Math.round((taken / WEEKLY_DATA.length) * 100);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Weekly Compliance</Text>
      <Text style={styles.cardSubtitle}>Last 7 days</Text>

      {/* Circle */}
      <View style={styles.circleRow}>
        <View style={styles.circle}>
          <Text style={styles.circlePercent}>{pct}%</Text>
          <Text style={styles.circleLabel}>adherence</Text>
        </View>

        {/* Day pills */}
        <View style={styles.dayGrid}>
          {WEEKLY_DATA.map((taken, i) => (
            <View key={i} style={styles.dayItem}>
              <View style={[styles.dayDot, taken ? styles.dayDotTaken : styles.dayDotMissed]}>
                <Ionicons
                  name={taken ? "checkmark" : "close"}
                  size={12}
                  color="#fff"
                />
              </View>
              <Text style={styles.dayLabel}>{DAY_LABELS[i]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{taken}</Text>
          <Text style={styles.statLabel}>Taken</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: "#dc2626" }]}>{WEEKLY_DATA.length - taken}</Text>
          <Text style={styles.statLabel}>Missed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{WEEKLY_DATA.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>
    </View>
  );
}

function QuickActionsGrid() {
  return (
    <View>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [styles.actionCard, { backgroundColor: action.bg, opacity: pressed ? 0.75 : 1 }]}
            android_ripple={{ color: action.color + "22" }}
          >
            <View style={[styles.actionIconBg, { backgroundColor: action.color + "18" }]}>
              <Ionicons name={action.icon} size={26} color={action.color} />
            </View>
            <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function HealthTipCard({ tip }: { tip: HealthTip; }) {
  return (
    <View style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconBg}>
          <Ionicons name={tip.icon} size={22} color="#f59e0b" />
        </View>
        <Text style={styles.tipTitle}>{tip.title}</Text>
      </View>
      <Text style={styles.tipBody}>{tip.body}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.screenTitle}>Explore</Text>
        <SearchBar />

        {/* Adherence dashboard */}
        <AdherenceDashboard />

        {/* Quick actions */}
        <QuickActionsGrid />

        {/* Health tip */}
        <Text style={styles.sectionTitle}>Health Tips</Text>
        <HealthTipCard tip={HEALTH_TIP} />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 14,
  },

  // Search
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 16,
  },

  // Adherence circle row
  circleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 20,
  },
  circle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 7,
    borderColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  circlePercent: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2563eb",
  },
  circleLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 1,
  },

  // Day grid
  dayGrid: {
    flexDirection: "row",
    flex: 1,
    justifyContent: "space-between",
  },
  dayItem: {
    alignItems: "center",
    gap: 4,
  },
  dayDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dayDotTaken: { backgroundColor: "#2563eb" },
  dayDotMissed: { backgroundColor: "#dc2626" },
  dayLabel: {
    fontSize: 10,
    color: "#6b7280",
    fontWeight: "600",
  },

  // Stat row
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    paddingVertical: 12,
  },
  stat: { alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700", color: "#1f2937" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: "#e5e7eb" },

  // Section title
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },

  // Quick actions
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: "47%",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 110,
    gap: 10,
  },
  actionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },

  // Health tip
  tipCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 16,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  tipIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400e",
  },
  tipBody: {
    fontSize: 14,
    color: "#78350f",
    lineHeight: 21,
  },

  bottomSpacer: { height: 32 },
});
