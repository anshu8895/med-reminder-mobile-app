import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Medicine } from "../constants/medicine";
import { getMedicines } from "../lib/storage";

type FDAResult = {
    purpose?: string[];
    warnings?: string[];
    dosage_and_administration?: string[];
    brand_name?: string[];
    generic_name?: string[];
};

// ─── Reusable sub-component (outside screen → no re-creation on each render) ──

const COLLAPSED_LINES = 6;

function InfoSection({
    title,
    items,
    warning = false,
}: {
    title: string;
    items?: string[];
    warning?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    if (!items || items.length === 0) return null;
    const text = items[0];
    // Estimate whether the text is long enough to warrant truncation
    const isLong = text.length > 400;

    return (
        <View style={[styles.infoSection, warning && styles.warningSection]}>
            {warning ? (
                <View style={styles.warningHeader}>
                    <Ionicons name="warning-outline" size={16} color="#dc2626" style={{ marginRight: 6 }} />
                    <Text style={[styles.infoTitle, { color: "#dc2626" }]}>{title}</Text>
                </View>
            ) : (
                <Text style={styles.infoTitle}>{title}</Text>
            )}
            <Text
                style={styles.infoBody}
                numberOfLines={isLong && !expanded ? COLLAPSED_LINES : undefined}
            >
                {text}
            </Text>
            {isLong && (
                <Pressable onPress={() => setExpanded((e) => !e)} style={styles.readMoreBtn}>
                    <Text style={styles.readMoreText}>{expanded ? "Show less" : "Read more…"}</Text>
                </Pressable>
            )}
        </View>
    );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DrugInfoScreen() {
    const router = useRouter();
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [selected, setSelected] = useState<Medicine | null>(null);
    const [fdaData, setFdaData] = useState<FDAResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            getMedicines().then(setMedicines);
        }, [])
    );

    // Named back handler — cleaner than the inline ternary+comma expression
    function handleBack() {
        if (selected) {
            setSelected(null);
            setFdaData(null);
            setError(null);
        } else {
            router.back();
        }
    }

    async function lookupDrug(med: Medicine) {
        setSelected(med);
        setFdaData(null);
        setError(null);
        setLoading(true);
        try {
            const url = `https://api.fda.gov/drug/label.json?search=brand_name:"${encodeURIComponent(med.name)}"&limit=1`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("not found");
            const json = await res.json();
            const result: FDAResult = json.results?.[0] ?? null;
            if (!result) throw new Error("not found");
            setFdaData(result);
        } catch (err) {
            // Distinguish network failures from "not found" responses
            const isNetworkError = err instanceof TypeError;
            if (isNetworkError) {
                // Probably offline — don't even try the fallback
                setError("Network error. Please check your connection and try again.");
                setLoading(false);
                return;
            }
            // Fallback: try generic name search
            try {
                const url2 = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(med.name)}"&limit=1`;
                const res2 = await fetch(url2);
                if (!res2.ok) throw new Error("not found");
                const json2 = await res2.json();
                const result2: FDAResult = json2.results?.[0] ?? null;
                if (!result2) throw new Error("not found");
                setFdaData(result2);
            } catch (err2) {
                const isNetworkError2 = err2 instanceof TypeError;
                setError(
                    isNetworkError2
                        ? "Network error. Please check your connection and try again."
                        : `No FDA database entry found for "${med.name}". Try the generic chemical name.`
                );
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={12}>
                    <Ionicons name="chevron-back" size={22} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {selected ? selected.name : "Drug Information"}
                </Text>
            </View>

            {!selected ? (
                // Medicine list
                <FlatList
                    data={medicines}
                    keyExtractor={(m) => m.id}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <Text style={styles.hint}>Tap a medicine to look up its FDA label information.</Text>
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="medkit-outline" size={56} color="#d1d5db" />
                            <Text style={styles.emptyText}>No medicines added yet.</Text>
                            <Text style={styles.emptySubText}>Add medicines from the Home tab first.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.medRow} onPress={() => lookupDrug(item)} activeOpacity={0.8}>
                            <View style={styles.medIconBg}>
                                <Ionicons name="medical" size={20} color="#2563eb" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.medName}>{item.name}</Text>
                                <Text style={styles.medSub}>
                                    {item.times?.length ?? 0} dose{(item.times?.length ?? 0) !== 1 ? "s" : ""} per day
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                />
            ) : (
                // Drug detail
                <ScrollView contentContainerStyle={styles.listContent}>
                    {loading && (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#2563eb" />
                            <Text style={styles.loadingText}>Looking up FDA database…</Text>
                        </View>
                    )}

                    {!loading && error && (
                        <View style={styles.errorBox}>
                            <Ionicons name="information-circle-outline" size={32} color="#d97706" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {!loading && fdaData && (
                        <View>
                            <View style={styles.drugHeader}>
                                <View style={styles.drugIconBg}>
                                    <Ionicons name="flask" size={28} color="#2563eb" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.drugName}>{fdaData.brand_name?.[0] ?? selected.name}</Text>
                                    {fdaData.generic_name?.[0] && (
                                        <Text style={styles.drugGeneric}>{fdaData.generic_name[0]}</Text>
                                    )}
                                </View>
                            </View>

                            <View style={styles.badge}>
                                <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
                                <Text style={styles.badgeText}>FDA Label Data</Text>
                            </View>

                            <InfoSection title="Purpose" items={fdaData.purpose} />
                            <InfoSection title="Dosage & Administration" items={fdaData.dosage_and_administration} />
                            <InfoSection title="Warnings" items={fdaData.warnings} warning />

                            <View style={styles.disclaimer}>
                                <Ionicons name="information-circle-outline" size={13} color="#0369a1" style={{ marginRight: 6, marginTop: 2 }} />
                                <Text style={styles.disclaimerText}>
                                    This information is from the official FDA drug label database. Always follow your doctor's guidance.
                                </Text>
                            </View>
                        </View>
                    )}
                </ScrollView>
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
    headerTitle: { fontSize: 20, fontWeight: "700", color: "#1f2937", flex: 1 },
    listContent: { padding: 16, paddingBottom: 40 },
    hint: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
    empty: { alignItems: "center", paddingTop: 60 },
    emptyText: { fontSize: 18, fontWeight: "600", color: "#6b7280", marginTop: 16 },
    emptySubText: { fontSize: 15, color: "#9ca3af", marginTop: 8, textAlign: "center" },
    medRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    medIconBg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#eff6ff",
        alignItems: "center",
        justifyContent: "center",
    },
    medName: { fontSize: 17, fontWeight: "600", color: "#1f2937" },
    medSub: { fontSize: 13, color: "#6b7280", marginTop: 2 },
    loadingBox: { alignItems: "center", paddingTop: 60, gap: 16 },
    loadingText: { fontSize: 16, color: "#6b7280" },
    errorBox: {
        backgroundColor: "#fffbeb",
        borderRadius: 14,
        padding: 20,
        borderLeftWidth: 4,
        borderLeftColor: "#d97706",
        gap: 12,
        alignItems: "flex-start",
    },
    errorText: { fontSize: 15, color: "#92400e", lineHeight: 22 },
    drugHeader: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        gap: 14,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 3,
    },
    drugIconBg: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#eff6ff",
        alignItems: "center",
        justifyContent: "center",
    },
    drugName: { fontSize: 20, fontWeight: "700", color: "#1f2937" },
    drugGeneric: { fontSize: 14, color: "#6b7280", marginTop: 2 },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f0fdf4",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignSelf: "flex-start",
        marginBottom: 16,
    },
    badgeText: { fontSize: 12, fontWeight: "700", color: "#059669" },
    infoSection: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    infoTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    infoBody: { fontSize: 15, color: "#1f2937", lineHeight: 23 },
    readMoreBtn: { marginTop: 8 },
    readMoreText: { fontSize: 13, fontWeight: "600", color: "#2563eb" },
    warningSection: { borderLeftWidth: 4, borderLeftColor: "#dc2626" },
    warningHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    disclaimer: {
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: "#f0f9ff",
        borderRadius: 12,
        padding: 14,
        marginTop: 4,
    },
    disclaimerText: { flex: 1, fontSize: 13, color: "#0369a1", lineHeight: 20 },
});
