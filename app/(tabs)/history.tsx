import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    Alert,
    Pressable,
    SectionList,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TakenLog } from "../../constants/medicine";
import { triggerHomeRefresh } from "../../lib/events";
import { clearAllData, clearAllTakenLogs, getTakenLogs } from "../../lib/storage";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function toDateKey(iso: string): string {
    return new Date(iso).toDateString();
}

function dateLabel(dateKey: string): string {
    const todayKey = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toDateString();
    if (dateKey === todayKey) return "Today";
    if (dateKey === yesterdayKey) return "Yesterday";
    return new Date(dateKey).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });
}

type Section = { title: string; data: TakenLog[]; };

function groupLogsByDate(logs: TakenLog[]): Section[] {
    // Sort newest-first
    const sorted = [...logs].sort(
        (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
    );
    const map = new Map<string, TakenLog[]>();
    for (const log of sorted) {
        const key = toDateKey(log.takenAt);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(log);
    }
    return Array.from(map.entries()).map(([key, data]) => ({
        title: dateLabel(key),
        data,
    }));
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
    const [sections, setSections] = useState<Section[]>([]);
    const [totalCount, setTotalCount] = useState(0);

    const loadLogs = useCallback(async (setActive?: () => boolean) => {
        try {
            const logs = await getTakenLogs();
            // Respect cancellation if called from useFocusEffect
            if (setActive && !setActive()) return;
            setTotalCount(logs.length);
            setSections(groupLogsByDate(logs));
        } catch {
            Alert.alert("Error", "Failed to load history. Please try again.");
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            let active = true;
            loadLogs(() => active);
            return () => { active = false; };
        }, [loadLogs])
    );

    const resetAllDevData = () => {
        Alert.alert(
            "⚠️ DEV: Wipe ALL Data?",
            "Cancels all notifications, clears medicines, history and snooze state. Use once after a data model migration.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Wipe Everything",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await clearAllData(); // notifications cancelled first, then storage

                            // 1. Reset THIS screen's state
                            setSections([]);
                            setTotalCount(0);

                            // 2. Trigger event bus so Home screen immediately clears too
                            //    (medicines, takenDoseKeys, snoozedDoseKeys all refetch to empty)
                            triggerHomeRefresh();

                            Alert.alert("Done", "All data wiped. Re-add your medicines.");
                        } catch (err) {
                            // Do NOT update UI on partial failure — state may be inconsistent
                            Alert.alert(
                                "Reset failed",
                                "Something went wrong. Some data may not have been cleared. Try again."
                            );
                        }
                    },
                },
            ]
        );
    };

    const confirmClear = () => {
        Alert.alert(
            "Clear all history?",
            "This will remove all dose history. Your medicines and reminders will stay intact.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        await clearAllTakenLogs();
                        setSections([]);
                        setTotalCount(0);
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.screenTitle}>History</Text>
                    <Text style={styles.screenSub}>
                        {totalCount === 0
                            ? "No medicines marked yet"
                            : `${totalCount} dose${totalCount > 1 ? "s" : ""} recorded`}
                    </Text>
                </View>
                {totalCount > 0 && (
                    <Pressable
                        onPress={confirmClear}
                        style={({ pressed }) => [styles.clearBtn, { opacity: pressed ? 0.7 : 1 }]}
                    >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        <Text style={styles.clearBtnText}>Clear</Text>
                    </Pressable>
                )}
                {/* DEV ONLY — gated behind __DEV__ so it cannot ship to production */}
                {__DEV__ && (
                    <Pressable
                        onPress={resetAllDevData}
                        style={({ pressed }) => [styles.devResetBtn, { opacity: pressed ? 0.7 : 1 }]}
                    >
                        <Ionicons name="warning-outline" size={14} color="#92400e" />
                        <Text style={styles.devResetBtnText}>DEV Reset</Text>
                    </Pressable>
                )}
            </View>

            {/* ── Summary strip ── */}
            {totalCount > 0 && (
                <View style={styles.summaryStrip}>
                    <View style={styles.summaryItem}>
                        <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                        <Text style={styles.summaryValue}>{totalCount}</Text>
                        <Text style={styles.summaryLabel}>Total Taken</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Ionicons name="calendar-outline" size={18} color="#2563eb" />
                        <Text style={styles.summaryValue}>{sections.length}</Text>
                        <Text style={styles.summaryLabel}>
                            {sections.length === 1 ? "Day" : "Days"}
                        </Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Ionicons name="today-outline" size={18} color="#f59e0b" />
                        <Text style={styles.summaryValue}>
                            {sections[0]?.title === "Today" ? sections[0].data.length : 0}
                        </Text>
                        <Text style={styles.summaryLabel}>Today</Text>
                    </View>
                </View>
            )}

            {/* ── Log list ── */}
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Ionicons name="time-outline" size={56} color="#d1d5db" />
                        <Text style={styles.emptyTitle}>No history yet</Text>
                        <Text style={styles.emptySub}>
                            Tap ✓ on a medicine card to record a dose
                        </Text>
                    </View>
                }
                renderSectionHeader={({ section }) => (
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionLine} />
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <View style={styles.sectionLine} />
                    </View>
                )}
                renderItem={({ item }) => (
                    <View style={styles.logCard}>
                        <View style={styles.logIconBg}>
                            <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                        </View>
                        <View style={styles.logInfo}>
                            <Text style={styles.logName}>{item.medicineName}</Text>
                            <Text style={styles.logTime}>Taken at {formatTime(item.takenAt)}</Text>
                        </View>
                        {/* Dose N badge — always shown so the entry is self-describing */}
                        <View style={styles.dosePill}>
                            <Text style={styles.dosePillText}>Dose {item.timeIndex + 1}</Text>
                        </View>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#f5f5f5" },

    // Header
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
    },
    screenTitle: { fontSize: 28, fontWeight: "700", color: "#1f2937" },
    screenSub: { fontSize: 13, color: "#6b7280", marginTop: 2 },
    clearBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#fef2f2",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    clearBtnText: { fontSize: 13, color: "#ef4444", fontWeight: "600" },

    // DEV only — remove before production
    devResetBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "#fffbeb",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#fde68a",
    },
    devResetBtnText: { fontSize: 12, color: "#92400e", fontWeight: "700" },

    // Summary strip
    summaryStrip: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        backgroundColor: "#fff",
        marginHorizontal: 16,
        borderRadius: 14,
        paddingVertical: 14,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 2,
    },
    summaryItem: { alignItems: "center", gap: 3, flex: 1 },
    summaryValue: { fontSize: 20, fontWeight: "700", color: "#1f2937" },
    summaryLabel: { fontSize: 11, color: "#6b7280" },
    summaryDivider: { width: 1, height: 36, backgroundColor: "#e5e7eb" },

    // Section header
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    sectionLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#9ca3af",
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },

    // Log card
    listContent: { paddingBottom: 32 },
    logCard: {
        backgroundColor: "#fff",
        marginHorizontal: 16,
        marginVertical: 4,
        borderRadius: 12,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    logIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#d1fae5",
        alignItems: "center",
        justifyContent: "center",
    },
    logInfo: { flex: 1 },
    logName: { fontSize: 15, fontWeight: "600", color: "#1f2937" },
    logTime: { fontSize: 12, color: "#6b7280", marginTop: 2 },

    // Dose badge (shown on every history entry)
    dosePill: {
        backgroundColor: "#eff6ff",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#bfdbfe",
    },
    dosePillText: { fontSize: 11, fontWeight: "700", color: "#1e40af" },

    // Empty
    emptyBox: {
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 80,
        gap: 10,
        paddingHorizontal: 32,
    },
    emptyTitle: { fontSize: 18, fontWeight: "600", color: "#9ca3af" },
    emptySub: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
});
