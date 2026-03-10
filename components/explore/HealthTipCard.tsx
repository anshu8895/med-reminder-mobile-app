import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { HealthTip } from "./types";

export function HealthTipCard({ tip }: { tip: HealthTip; }) {
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

const styles = StyleSheet.create({
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
    tipHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    tipIconBg: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#fef3c7",
        alignItems: "center",
        justifyContent: "center",
    },
    tipTitle: { fontSize: 15, fontWeight: "700", color: "#92400e" },
    tipBody: { fontSize: 14, color: "#78350f", lineHeight: 21 },
});
