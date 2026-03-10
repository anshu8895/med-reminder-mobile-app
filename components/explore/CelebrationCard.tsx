import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function CelebrationCard({ onDismiss }: { onDismiss: () => void; }) {
    return (
        <View style={styles.celebCard}>
            <View style={styles.content}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="sparkles" size={16} color="#15803d" style={{ marginRight: 6 }} />
                    <Text style={styles.celebTitle}>All doses completed today!</Text>
                </View>
                <Text style={styles.celebBody}>Great job staying consistent.</Text>
            </View>
            <Pressable onPress={onDismiss} hitSlop={10} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="#15803d" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    celebCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f0fdf4",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: "#16a34a",
    },
    content: { flex: 1 },
    celebTitle: { fontSize: 15, fontWeight: "700", color: "#15803d" },
    celebBody: { fontSize: 13, color: "#166534", marginTop: 2 },
    closeBtn: { marginLeft: 8, padding: 2 },
});
