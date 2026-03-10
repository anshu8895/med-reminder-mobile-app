import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Medicine } from "../../constants/medicine";
import { HealthTip } from "./types";

// ─── SearchBar ────────────────────────────────────────────────────────────────

export function SearchBar({
    query,
    onChangeQuery,
}: {
    query: string;
    onChangeQuery: (q: string) => void;
}) {
    return (
        <View style={styles.searchWrapper}>
            <Ionicons name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
            <TextInput
                style={styles.searchInput}
                placeholder="Search medications or tips…"
                placeholderTextColor="#9ca3af"
                value={query}
                onChangeText={onChangeQuery}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
            />
            {query.length > 0 && (
                <Pressable onPress={() => onChangeQuery("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color="#9ca3af" />
                </Pressable>
            )}
        </View>
    );
}

// ─── SearchResults ────────────────────────────────────────────────────────────

export function SearchResults({
    query,
    medicines,
    tips,
}: {
    query: string;
    medicines: Medicine[];
    tips: HealthTip[];
}) {
    const router = useRouter();
    if (query.trim().length === 0) return null;

    const q = query.toLowerCase();
    const matchedMeds = medicines.filter((m) => m.name.toLowerCase().includes(q));
    const matchedTips = tips.filter(
        (t) => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
    );

    return (
        <View style={styles.searchResults}>
            {matchedMeds.length === 0 && matchedTips.length === 0 && (
                <Text style={styles.searchEmpty}>No results for "{query}"</Text>
            )}

            {matchedMeds.length > 0 && (
                <>
                    <Text style={styles.searchSectionLabel}>YOUR MEDICINES</Text>
                    {matchedMeds.map((m) => (
                        <Pressable
                            key={m.id}
                            style={styles.searchResultRow}
                            onPress={() =>
                                router.push({ pathname: "/(tabs)/edit-medicine", params: { id: m.id } })
                            }
                        >
                            <View style={styles.searchResultIconBg}>
                                <Ionicons name="medkit" size={16} color="#2563eb" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.searchResultTitle}>{m.name}</Text>
                                <Text style={styles.searchResultSub}>
                                    {m.times?.length ?? 0} dose{(m.times?.length ?? 0) !== 1 ? "s" : ""} per day · Tap to edit
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                        </Pressable>
                    ))}
                </>
            )}

            {matchedTips.length > 0 && (
                <>
                    <Text style={[styles.searchSectionLabel, { marginTop: matchedMeds.length > 0 ? 12 : 0 }]}>
                        HEALTH TIPS
                    </Text>
                    {matchedTips.map((tip, i) => (
                        <View key={i} style={styles.searchResultRow}>
                            <View style={[styles.searchResultIconBg, { backgroundColor: "#fef3c7" }]}>
                                <Ionicons name={tip.icon} size={16} color="#f59e0b" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.searchResultTitle}>{tip.title}</Text>
                                <Text style={styles.searchResultSub} numberOfLines={2}>
                                    {tip.body}
                                </Text>
                            </View>
                        </View>
                    ))}
                </>
            )}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    searchWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 2,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, color: "#1f2937" },

    searchResults: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 2,
    },
    searchEmpty: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 8 },
    searchSectionLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: "#9ca3af",
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    searchResultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
    searchResultIconBg: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: "#eff6ff",
        alignItems: "center",
        justifyContent: "center",
    },
    searchResultTitle: { fontSize: 14, fontWeight: "600", color: "#1f2937" },
    searchResultSub: { fontSize: 12, color: "#6b7280", marginTop: 1 },
});
