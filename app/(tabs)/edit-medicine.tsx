import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DoseTime } from "../../constants/medicine";
import { getMedicines, saveMedicines } from "../../lib/storage";

// ─── Constants ────────────────────────────────────────────────────────────────

type Frequency = 1 | 2 | 3;
const FREQ_LABELS: Record<Frequency, string> = { 1: "Once", 2: "Twice", 3: "Thrice" };

/** Candidate times to append when extending — filtered against existing times in use. */
const EXTRA_DEFAULTS: DoseTime[] = [
    { hour: 14, minute: 0 },
    { hour: 20, minute: 0 },
    { hour: 22, minute: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function doseTimeToDate(dt: DoseTime): Date {
    const d = new Date();
    d.setHours(dt.hour, dt.minute, 0, 0);
    return d;
}

function formatTime(dt: DoseTime): string {
    const d = new Date();
    d.setHours(dt.hour, dt.minute, 0, 0);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditMedicineScreen() {
    const { id } = useLocalSearchParams<{ id: string; }>();
    const router = useRouter();

    const [medicineName, setMedicineName] = useState("");
    const [frequency, setFrequency] = useState<Frequency>(1);
    const [times, setTimes] = useState<DoseTime[]>([{ hour: 8, minute: 0 }]);
    const [pickerIndex, setPickerIndex] = useState(-1);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // ── Load medicine on mount ─────────────────────────────────────────────────
    useEffect(() => {
        if (!id) return;
        (async () => {
            const medicines = await getMedicines();
            const medicine = medicines.find((m) => m.id === id);
            if (!medicine) {
                Alert.alert("Not found", "Medicine could not be loaded.");
                router.back();
                return;
            }
            setMedicineName(medicine.name);
            // Clamp to 1–3 in case of corrupted data
            const freq = Math.min(Math.max(medicine.times.length, 1), 3) as Frequency;
            setFrequency(freq);
            setTimes(medicine.times.slice(0, 3));
            setIsLoaded(true);
        })();
    }, [id]);

    const canSubmit =
        isLoaded &&
        medicineName.trim().length > 0 &&
        times.length === frequency;

    // ── Frequency change ───────────────────────────────────────────────────────
    const handleFrequencyChange = (freq: Frequency) => {
        setFrequency(freq);
        setTimes((prev) => {
            if (freq > prev.length) {
                const used = new Set(prev.map((t) => `${t.hour}:${t.minute}`));
                const extras = EXTRA_DEFAULTS
                    .filter((t) => !used.has(`${t.hour}:${t.minute}`))
                    .slice(0, freq - prev.length);
                return [...prev, ...extras].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
            }
            return prev.slice(0, freq);
        });
        setPickerIndex(-1);
    };

    // ── Time picker change ─────────────────────────────────────────────────────
    const handleTimeChange = (index: number, selectedDate: Date | undefined) => {
        if (!selectedDate) return;
        setTimes((prev) => {
            const updated = [...prev];
            updated[index] = {
                hour: selectedDate.getHours(),
                minute: selectedDate.getMinutes(),
            };
            return updated;
        });
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!canSubmit) return;

        // Prevent two doses at identical times
        const uniqueTimes = new Set(times.map((t) => `${t.hour}:${t.minute}`));
        if (uniqueTimes.size !== times.length) {
            Alert.alert("Invalid times", "Each dose must have a different time.");
            return;
        }

        const medicines = await getMedicines();

        // Guard: medicine may have been deleted in another tab while this screen was open
        if (!medicines.some((m) => m.id === id)) {
            Alert.alert("Not found", "This medicine no longer exists.");
            router.back();
            return;
        }

        // Guard: skip save entirely if nothing changed (avoids unnecessary notification churn)
        const original = medicines.find((m) => m.id === id);
        if (
            original &&
            original.name === medicineName.trim() &&
            JSON.stringify(original.times) === JSON.stringify(times)
        ) {
            router.back();
            return;
        }

        // Safety-net sort: times are sorted by handleTimeChange and handleFrequencyChange,
        // but an explicit final sort here ensures correctness if any path is ever missed.
        const sortedTimes = [...times].sort(
            (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
        );

        setIsSaving(true);
        try {
            const updated = medicines.map((m) =>
                m.id === id
                    ? { ...m, name: medicineName.trim(), times: sortedTimes }
                    : m
            );
            await saveMedicines(updated);
            router.back();
        } catch {
            Alert.alert("Error", "Failed to save. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    // ── Loading state ──────────────────────────────────────────────────────────
    if (!isLoaded) {
        return (
            <SafeAreaView style={styles.safeArea} edges={["top"]}>
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#6b7280" }}>Loading…</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Back */}
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={20} color="#7c3aed" />
                        <Text style={styles.backText}>Back</Text>
                    </Pressable>

                    {/* Header */}
                    <View style={styles.headerRow}>
                        <View style={styles.headerIconBg}>
                            <Ionicons name="pencil" size={24} color="#7c3aed" />
                        </View>
                        <View>
                            <Text style={styles.title}>Edit Medicine</Text>
                            <Text style={styles.subtitle}>Update name, frequency or times</Text>
                        </View>
                    </View>

                    {/* ── Name + Frequency card ─────────────────────────────── */}
                    <View style={styles.card}>
                        {/* Name */}
                        <Text style={styles.fieldLabel}>Medicine Name</Text>
                        <View style={[styles.inputWrapper, medicineName.length > 0 && styles.inputFocused]}>
                            <Ionicons name="medical-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Paracetamol 500mg"
                                placeholderTextColor="#9ca3af"
                                value={medicineName}
                                onChangeText={setMedicineName}
                                returnKeyType="done"
                                autoCapitalize="words"
                            />
                        </View>

                        {/* Frequency */}
                        <Text style={styles.fieldLabel}>Daily Frequency</Text>
                        <View style={styles.freqRow}>
                            {([1, 2, 3] as Frequency[]).map((f) => (
                                <Pressable
                                    key={f}
                                    style={[
                                        styles.freqBtn,
                                        frequency === f && styles.freqBtnActive,
                                        pickerIndex !== -1 && styles.freqBtnDisabled,
                                    ]}
                                    onPress={() => pickerIndex === -1 && handleFrequencyChange(f)}
                                >
                                    <Text style={[styles.freqBtnText, frequency === f && styles.freqBtnTextActive]}>
                                        {FREQ_LABELS[f]}
                                    </Text>
                                    <Text style={[styles.freqBtnSub, frequency === f && styles.freqBtnSubActive]}>
                                        {f}× / day
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* ── Dose time pickers ─────────────────────────────────── */}
                    <View style={styles.card}>
                        <Text style={styles.fieldLabel}>Reminder Times</Text>

                        {times.map((dt, i) => (
                            <View key={i}>
                                <Pressable
                                    style={[styles.timeRow, pickerIndex === i && styles.timeRowActive]}
                                    onPress={() => setPickerIndex(pickerIndex === i ? -1 : i)}
                                >
                                    <View style={styles.doseLabel}>
                                        <Text style={styles.doseLabelText}>Dose {i + 1}</Text>
                                    </View>
                                    <Ionicons name="time-outline" size={16} color="#6b7280" style={{ marginRight: 8 }} />
                                    <Text style={styles.timeValue}>{formatTime(dt)}</Text>
                                    <Ionicons
                                        name={pickerIndex === i ? "chevron-up" : "chevron-down"}
                                        size={16}
                                        color="#9ca3af"
                                    />
                                </Pressable>

                                {/* Platform-specific pickers */}
                                {/* iOS: Always mounted, hidden via style, uses spinner */}
                                {Platform.OS === "ios" && (
                                    <View style={{ display: pickerIndex === i ? "flex" : "none" }}>
                                        <DateTimePicker
                                            value={doseTimeToDate(dt)}
                                            mode="time"
                                            display="spinner"
                                            onChange={(_, date) => handleTimeChange(i, date)}
                                        />
                                    </View>
                                )}

                                {/* Android: Conditionally rendered, uses default dialog */}
                                {Platform.OS === "android" && pickerIndex === i && (
                                    <DateTimePicker
                                        value={doseTimeToDate(dt)}
                                        mode="time"
                                        display="default"
                                        onChange={(_, date) => {
                                            setPickerIndex(-1); // Close dialog on Android
                                            handleTimeChange(i, date);
                                        }}
                                    />
                                )}

                                {i < times.length - 1 && <View style={styles.divider} />}
                            </View>
                        ))}
                    </View>

                    {/* Hint */}
                    <View style={styles.hintCard}>
                        <Ionicons name="information-circle-outline" size={16} color="#7c3aed" />
                        <Text style={styles.hintText}>
                            {frequency === 1
                                ? `Daily reminder at ${formatTime(times[0])}`
                                : `${frequency} daily reminders: ${times.map(formatTime).join(", ")}`}
                        </Text>
                    </View>

                    {/* Save */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.primaryBtn,
                            !canSubmit && styles.primaryBtnDisabled,
                            { opacity: pressed ? 0.85 : 1 },
                        ]}
                        onPress={handleSave}
                        disabled={!canSubmit || isSaving}
                    >
                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        <Text style={styles.primaryBtnText}>
                            {isSaving ? "Saving…" : "Save Changes"}
                        </Text>
                    </Pressable>

                    {/* Cancel */}
                    <Pressable
                        style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.ghostBtnText}>Cancel</Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#f5f5f5" },
    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

    backBtn: {
        flexDirection: "row", alignItems: "center",
        marginBottom: 8, alignSelf: "flex-start", gap: 2,
    },
    backText: { fontSize: 15, color: "#7c3aed", fontWeight: "600" },

    headerRow: {
        flexDirection: "row", alignItems: "center",
        gap: 14, marginBottom: 24, marginTop: 4,
    },
    headerIconBg: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: "#f5f3ff", alignItems: "center", justifyContent: "center",
    },
    title: { fontSize: 24, fontWeight: "700", color: "#1f2937" },
    subtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },

    card: {
        backgroundColor: "#fff", borderRadius: 16, padding: 18,
        marginBottom: 12, shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07,
        shadowRadius: 6, elevation: 3,
    },
    fieldLabel: {
        fontSize: 12, fontWeight: "700", color: "#6b7280",
        textTransform: "uppercase", letterSpacing: 0.8,
        marginBottom: 10, marginTop: 4,
    },

    inputWrapper: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "#f9fafb", borderWidth: 1.5,
        borderColor: "#e5e7eb", borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 12, marginBottom: 18,
    },
    inputFocused: { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: "#1f2937" },

    freqRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
    freqBtn: {
        flex: 1, alignItems: "center", paddingVertical: 12,
        borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb",
        backgroundColor: "#f9fafb",
    },
    freqBtnActive: { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" },
    freqBtnText: { fontSize: 14, fontWeight: "700", color: "#6b7280" },
    freqBtnTextActive: { color: "#6d28d9" },
    freqBtnSub: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
    freqBtnSubActive: { color: "#7c3aed" },
    freqBtnDisabled: { opacity: 0.4 },

    timeRow: {
        flexDirection: "row", alignItems: "center",
        paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10,
    },
    timeRowActive: { backgroundColor: "#f5f3ff" },
    doseLabel: {
        backgroundColor: "#7c3aed", borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 3, marginRight: 10,
    },
    doseLabelText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    timeValue: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1f2937" },
    divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 2 },

    hintCard: {
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: "#f5f3ff", borderRadius: 12, padding: 12,
        marginBottom: 16, borderLeftWidth: 3, borderLeftColor: "#7c3aed",
    },
    hintText: { flex: 1, fontSize: 13, color: "#4c1d95" },

    primaryBtn: {
        backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 15,
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, marginBottom: 12, shadowColor: "#7c3aed",
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
        shadowRadius: 8, elevation: 5,
    },
    primaryBtnDisabled: { backgroundColor: "#c4b5fd", shadowOpacity: 0, elevation: 0 },
    primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },

    ghostBtn: {
        borderRadius: 14, paddingVertical: 14, alignItems: "center",
        backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb",
    },
    ghostBtnText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
});