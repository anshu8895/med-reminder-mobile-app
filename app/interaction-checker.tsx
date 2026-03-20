import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Medicine } from "../constants/medicine";
import { getMedicines } from "../lib/storage";

export default function InteractionCheckerScreen() {
    const router = useRouter();
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useFocusEffect(
        useCallback(() => {
            getMedicines().then(setMedicines);
            setSelected(new Set()); // reset selection on every focus
        }, [])
    );

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                if (next.size >= 5) return prev; // cap at 5
                next.add(id);
            }
            return next;
        });
    }

    function checkInteractions() {
        // Pass all selected medicine names as a comma-separated list for
        // a simultaneous multi-drug interaction check on drugs.com
        const names = medicines
            .filter((m) => selected.has(m.id))
            .map((m) => m.name.toLowerCase());
        const url = `https://www.drugs.com/drug_interactions.php?drug_list=${names.map(encodeURIComponent).join(",")}`;
        Linking.openURL(url);
    }

    const selectedCount = selected.size;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
                    <Ionicons name="chevron-back" size={22} color="#1f2937" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Interaction Checker</Text>
                </View>
            </View>

            {/* Instructions */}
            <View style={styles.instructionCard}>
                <Ionicons name="information-circle-outline" size={20} color="#7c3aed" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.instructionText}>
                    Select <Text style={{ fontWeight: "700" }}>2–5 medicines</Text> below, then tap "Check Interactions" to search drugs.com for each medicine.
                </Text>
            </View>

            <FlatList
                data={medicines}
                keyExtractor={(m) => m.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="medkit-outline" size={56} color="#d1d5db" />
                        <Text style={styles.emptyText}>No medicines added yet.</Text>
                        <Text style={styles.emptySubText}>Add medicines from the Home tab first.</Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const isSelected = selected.has(item.id);
                    return (
                        <TouchableOpacity
                            style={[styles.medRow, isSelected && styles.medRowSelected]}
                            onPress={() => toggle(item.id)}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                                {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                            </View>
                            <View style={styles.medIconBg}>
                                <Ionicons name="medical" size={18} color="#7c3aed" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.medName}>{item.name}</Text>
                                <Text style={styles.medSub}>
                                    {item.times?.length ?? 0} dose{(item.times?.length ?? 0) !== 1 ? "s" : ""} per day
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />

            {/* Sticky Check Button */}
            {selectedCount >= 2 && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.checkBtn} onPress={checkInteractions} activeOpacity={0.85}>
                        <Ionicons name="open-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.checkBtnText}>
                            Check {selectedCount} Medicines for Interactions
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
            {selectedCount === 1 && (
                <View style={styles.footer}>
                    <View style={styles.checkBtnDisabled}>
                        <Text style={styles.checkBtnDisabledText}>Select at least one more medicine</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f3f4f6" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 56,
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
    },
    backBtn: { marginRight: 12, padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: "700", color: "#1f2937" },
    instructionCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#f5f3ff",
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 4,
        borderRadius: 12,
        padding: 14,
        borderLeftWidth: 3,
        borderLeftColor: "#7c3aed",
    },
    instructionText: { flex: 1, fontSize: 14, color: "#4c1d95", lineHeight: 21 },
    listContent: { padding: 16, paddingBottom: 24 },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyText: { fontSize: 18, fontWeight: "600", color: "#6b7280", marginTop: 16 },
    emptySubText: { fontSize: 15, color: "#9ca3af", marginTop: 8, textAlign: "center" },
    medRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 2,
        borderColor: "transparent",
    },
    medRowSelected: {
        borderColor: "#7c3aed",
        backgroundColor: "#faf5ff",
    },
    checkbox: {
        width: 26,
        height: 26,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#d1d5db",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
    },
    checkboxChecked: {
        backgroundColor: "#7c3aed",
        borderColor: "#7c3aed",
    },
    medIconBg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#f5f3ff",
        alignItems: "center",
        justifyContent: "center",
    },
    medName: { fontSize: 17, fontWeight: "600", color: "#1f2937" },
    medSub: { fontSize: 13, color: "#6b7280", marginTop: 1 },
    footer: {
        padding: 16,
        paddingBottom: 32,
        backgroundColor: "#f3f4f6",
        borderTopWidth: 1,
        borderTopColor: "#e5e7eb",
    },
    checkBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#7c3aed",
        borderRadius: 14,
        paddingVertical: 16,
    },
    checkBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    checkBtnDisabled: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#e5e7eb",
        borderRadius: 14,
        paddingVertical: 16,
    },
    checkBtnDisabledText: { fontSize: 15, fontWeight: "600", color: "#9ca3af" },
});
