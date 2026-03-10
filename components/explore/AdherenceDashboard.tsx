import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
    buildInsightMessage,
    getAdherenceLevel,
    localDayStart
} from "./adherenceHelpers";
import { MissRisk } from "./types";

// ─── StreakBanner ─────────────────────────────────────────────────────────────

function StreakBanner({ streak, color }: { streak: number; color: string; }) {
    const scaleAnim = useRef(new Animated.Value(0.85)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 120,
            friction: 8,
        }).start();
    }, [streak]);

    if (streak === 0) return null;

    const msg =
        streak === 1
            ? "Great start — keep it up!"
            : streak < 7
                ? "Building momentum — don't break it!"
                : "Outstanding consistency!";

    return (
        <Animated.View
            style={[
                styles.streakBanner,
                { borderLeftColor: color, backgroundColor: "#fff7ed", transform: [{ scale: scaleAnim }] },
            ]}
        >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="flame" size={15} color={color} style={{ marginRight: 6 }} />
                <Text style={[styles.streakBannerTitle, { color }]}>{streak}-day streak</Text>
                {streak >= 7 && (
                    <Ionicons name="trophy" size={15} color={color} style={{ marginLeft: 6 }} />
                )}
            </View>
            <Text style={styles.streakBannerBody}>{msg}</Text>
        </Animated.View>
    );
}

// ─── AdherenceInsightCard ─────────────────────────────────────────────────────

function AdherenceInsightCard({ risk }: { risk: MissRisk; }) {
    return (
        <View style={styles.insightCard}>
            <View style={styles.insightHeader}>
                <Ionicons name="bulb" size={16} color="#d97706" />
                <Text style={styles.insightTitle}> Adherence Insight</Text>
            </View>
            <Text style={styles.insightBody}>
                You miss <Text style={styles.insightHighlight}>{risk.slot} doses</Text> most often
                {" "}({risk.missCount} missed in the last month).
            </Text>
            <View style={styles.insightCta}>
                <Ionicons name="alarm-outline" size={14} color="#92400e" />
                <Text style={styles.insightCtaText}> Try setting a backup {risk.slot} reminder.</Text>
            </View>
        </View>
    );
}

// ─── AdherenceDashboard ───────────────────────────────────────────────────────

export function AdherenceDashboard({
    dailyData,
    streak,
    missRisk,
    weekTakenCount,
    weekTotalCount,
}: {
    dailyData: ("perfect" | "missed" | "empty")[];
    streak: number;
    missRisk: MissRisk | null;
    weekTakenCount: number;
    weekTotalCount: number;
}) {
    const pct = weekTotalCount > 0 ? Math.round((weekTakenCount / weekTotalCount) * 100) : 0;
    const level = getAdherenceLevel(pct);
    const insight =
        dailyData.length >= 14
            ? buildInsightMessage(
                dailyData.slice(-7).map((d) => d === "perfect"),
                dailyData.slice(-14, -7).map((d) => d === "perfect")
            )
            : "";

    // Scroll to today (rightmost) on data load
    const dotScrollRef = useRef<import("react-native").ScrollView>(null);
    useEffect(() => {
        if (dailyData.length === 0) return;
        const id = setTimeout(() => dotScrollRef.current?.scrollToEnd({ animated: false }), 50);
        return () => clearTimeout(id);
    }, [dailyData.length]);

    // Animated percentage counter
    const [displayPct, setDisplayPct] = useState(0);
    useEffect(() => {
        const anim = new Animated.Value(displayPct);
        const id = anim.addListener(({ value }) => setDisplayPct(Math.round(value)));
        Animated.timing(anim, {
            toValue: pct,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
        return () => anim.removeListener(id);
    }, [pct]);

    const radius = 41.5;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (displayPct / 100) * circumference;
    const ringColor =
        displayPct >= 80 ? "#16a34a" : displayPct >= 50 ? "#d97706" : "#dc2626";

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.cardHeaderRow}>
                <View>
                    <Text style={styles.cardTitle}>Adherence</Text>
                    <Text style={styles.cardSubtitle}>Last 7 days · Swipe for 30-day history</Text>
                </View>
                <View style={[styles.levelBadge, { backgroundColor: level.bg }]}>
                    <Text style={[styles.levelBadgeText, { color: level.color }]}>{level.label}</Text>
                </View>
            </View>

            {/* Circle + dot scroll */}
            <View style={styles.circleRow}>
                <View style={styles.circle}>
                    <View style={{ position: "absolute" }}>
                        <Svg width={90} height={90}>
                            <Circle cx={45} cy={45} r={radius} stroke="#e5e7eb" strokeWidth={7} fill="none" />
                            <Circle
                                cx={45}
                                cy={45}
                                r={radius}
                                stroke={ringColor}
                                strokeWidth={7}
                                fill="none"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                rotation="-90"
                                origin="45, 45"
                            />
                        </Svg>
                    </View>
                    <View style={{ alignItems: "center", justifyContent: "center" }}>
                        <Text style={[styles.circlePercent, { color: level.color }]}>{displayPct}%</Text>
                        <Text style={styles.circleLabel}>adherence</Text>
                    </View>
                </View>

                <ScrollView
                    ref={dotScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.dotScroll}
                    contentContainerStyle={styles.dotScrollContent}
                >
                    {(() => {
                        const MONTH_SHORT = [
                            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                        ];
                        return dailyData.map((day, i) => {
                            const date = localDayStart(29 - i);
                            const dateNum = date.getDate();
                            const isToday = i === 29;
                            const showMonth = dateNum === 1 || i === 0;
                            const dotBg =
                                day === "perfect" ? level.color : day === "missed" ? "#ef4444" : "#e5e7eb";
                            const iconName = day === "perfect" ? "checkmark" : "close";
                            return (
                                <View key={i} style={styles.dayItem}>
                                    <View style={[styles.dayDot, { backgroundColor: dotBg }]}>
                                        {day === "empty" ? (
                                            <View style={styles.emptyDot} />
                                        ) : (
                                            <Ionicons name={iconName} size={11} color="#fff" />
                                        )}
                                    </View>
                                    <Text
                                        style={[
                                            styles.dayLabel,
                                            isToday && { fontWeight: "800", fontSize: 12, color: level.color },
                                        ]}
                                    >
                                        {dateNum}
                                    </Text>
                                    {showMonth && (
                                        <Text style={styles.monthBoundary}>{MONTH_SHORT[date.getMonth()]}</Text>
                                    )}
                                </View>
                            );
                        });
                    })()}
                </ScrollView>
            </View>

            {/* Stat row */}
            <View style={styles.statRow}>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{weekTakenCount}</Text>
                    <Text style={styles.statLabel}>Taken</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: "#dc2626" }]}>
                        {weekTotalCount - weekTakenCount}
                    </Text>
                    <Text style={styles.statLabel}>Missed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{weekTotalCount}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                </View>
            </View>

            {insight !== "" && (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12 }}>
                    <Ionicons
                        name={
                            insight.startsWith("Up") ? "trending-up"
                                : insight.startsWith("Down") ? "trending-down"
                                    : "swap-horizontal"
                        }
                        size={16}
                        color="#4b5563"
                        style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.insightText, { marginTop: 0 }]}>{insight}</Text>
                </View>
            )}
            <StreakBanner streak={streak} color={level.color} />
            {missRisk && <AdherenceInsightCard risk={missRisk} />}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
    cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    cardTitle: { fontSize: 17, fontWeight: "700", color: "#1f2937" },
    cardSubtitle: { fontSize: 12, color: "#9ca3af", marginBottom: 16 },

    levelBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    levelBadgeText: { fontSize: 12, fontWeight: "700" },

    circleRow: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 20 },
    circle: { width: 90, height: 90, alignItems: "center", justifyContent: "center" },
    circlePercent: { fontSize: 20, fontWeight: "800" },
    circleLabel: { fontSize: 9, color: "#6b7280", marginTop: 1 },

    dotScroll: { flex: 1 },
    dotScrollContent: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 4, gap: 6 },
    dayItem: { alignItems: "center", gap: 2 },
    dayDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    emptyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#9ca3af" },
    dayLabel: { fontSize: 10, color: "#6b7280", fontWeight: "600" },
    monthBoundary: { fontSize: 8, color: "#9ca3af", fontWeight: "700", letterSpacing: 0.2 },

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

    insightText: { fontSize: 13, color: "#4b5563", marginTop: 12, textAlign: "center" },

    streakBanner: {
        marginTop: 14,
        borderRadius: 10,
        borderLeftWidth: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    streakBannerTitle: { fontSize: 14, fontWeight: "700" },
    streakBannerBody: { fontSize: 12, color: "#92400e", marginTop: 2 },

    insightCard: {
        marginTop: 12,
        backgroundColor: "#fffbeb",
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#d97706",
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    insightHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    insightTitle: { fontSize: 13, fontWeight: "700", color: "#92400e" },
    insightBody: { fontSize: 13, color: "#78350f", lineHeight: 20, marginBottom: 8 },
    insightHighlight: { fontWeight: "700", color: "#d97706" },
    insightCta: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fef3c7",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    insightCtaText: { fontSize: 12, color: "#92400e", fontWeight: "600" },
});
