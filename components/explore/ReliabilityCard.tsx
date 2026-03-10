import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { getAdherenceLevel } from "./adherenceHelpers";
import { MedReliability } from "./types";

export function ReliabilityCard({ data }: { data: MedReliability[]; }) {
    if (data.length === 0) return null;

    return (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Medication Reliability</Text>
            <Text style={[styles.cardSubtitle, { marginBottom: 12 }]}>Last 27 days</Text>

            {data.map((med, i) => {
                const level = getAdherenceLevel(med.adherencePct);
                return (
                    <View key={med.id}>
                        <View style={styles.reliabilityRow}>
                            <Text style={styles.reliabilityName} numberOfLines={1}>
                                {med.name}
                            </Text>
                            <View style={styles.reliabilityRight}>
                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Ionicons
                                            key={s}
                                            name={s <= med.stars ? "star" : "star-outline"}
                                            size={13}
                                            color={s <= med.stars ? level.color : "#e5e7eb"}
                                        />
                                    ))}
                                </View>
                                <Text style={[styles.reliabilityPct, { color: level.color }]}>
                                    {med.adherencePct}%
                                </Text>
                            </View>
                        </View>
                        {med.missedSlot && (
                            <Text style={styles.reliabilitySlot}>⚠ Missed most: {med.missedSlot}</Text>
                        )}
                        {i < data.length - 1 && <View style={styles.reliabilityDivider} />}
                    </View>
                );
            })}
        </View>
    );
}

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
    cardTitle: { fontSize: 17, fontWeight: "700", color: "#1f2937" },
    cardSubtitle: { fontSize: 12, color: "#9ca3af" },

    reliabilityRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
    },
    reliabilityName: { fontSize: 14, fontWeight: "600", color: "#1f2937", flex: 1, marginRight: 8 },
    reliabilityRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    starsRow: { flexDirection: "row", gap: 2 },
    reliabilityPct: { fontSize: 13, fontWeight: "700", minWidth: 36, textAlign: "right" },
    reliabilitySlot: { fontSize: 11, color: "#d97706", marginBottom: 4 },
    reliabilityDivider: { height: 1, backgroundColor: "#f3f4f6" },
});
