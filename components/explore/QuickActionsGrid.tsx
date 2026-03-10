import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { QUICK_ACTIONS } from "./types";

export function QuickActionsGrid() {
    return (
        <View>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.grid}>
                {QUICK_ACTIONS.map((action) => (
                    <Pressable
                        key={action.id}
                        style={({ pressed }) => [
                            styles.actionCard,
                            { backgroundColor: action.bg, opacity: pressed ? 0.75 : 1 },
                        ]}
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

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1f2937", marginBottom: 12 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
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
    actionLabel: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18 },
});
