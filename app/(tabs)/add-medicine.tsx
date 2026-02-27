import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useState } from "react";
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

/** Sensible default dose times for each frequency. */
const DEFAULT_TIMES: Record<Frequency, DoseTime[]> = {
    1: [{ hour: 8, minute: 0 }],
    2: [{ hour: 8, minute: 0 }, { hour: 20, minute: 0 }],
    3: [{ hour: 8, minute: 0 }, { hour: 14, minute: 0 }, { hour: 20, minute: 0 }],
};

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

export default function AddMedicineScreen() {
    const router = useRouter();
    const [medicineName, setMedicineName] = useState("");
    const [frequency, setFrequency] = useState<Frequency>(1);
    const [times, setTimes] = useState<DoseTime[]>(DEFAULT_TIMES[1]);
    // Which dose index is showing the time picker (-1 = none)
    const [pickerIndex, setPickerIndex] = useState(-1);
    const [isSaving, setIsSaving] = useState(false);

    const canSubmit =
        medicineName.trim().length > 0 &&
        times.length === frequency;

    // ── Frequency change ───────────────────────────────────────────────────────
    const handleFrequencyChange = (freq: Frequency) => {
        setFrequency(freq);
        setTimes((prev) => {
            let next: DoseTime[];
            if (freq > prev.length) {
                next = [...prev, ...DEFAULT_TIMES[freq].slice(prev.length)];
            } else {
                next = prev.slice(0, freq);
            }
            // Keep sorted so the hint and home screen order always match.
            return next.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
        });
        setPickerIndex(-1);
    };

    // ── Time picker change ─────────────────────────────────────────────────────
    const handleTimeChange = (index: number, selectedDate: Date | undefined) => {
        if (Platform.OS === "android") setPickerIndex(-1);
        if (!selectedDate) return;
        setTimes((prev) => {
            const updated = [...prev];
            updated[index] = {
                hour: selectedDate.getHours(),
                minute: selectedDate.getMinutes(),
            };
            // Sort ascending immediately so the hint and home screen order match.
            return [...updated].sort(
                (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
            );
        });
        setPickerIndex(-1);
    };

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleAdd = async () => {
        if (!canSubmit) {
            Alert.alert("Missing info", "Please enter a medicine name.");
            return;
        }
        // Prevent two doses at identical times — breaks notifications + progress math.
        const uniqueTimes = new Set(times.map((t) => `${t.hour}:${t.minute}`));
        if (uniqueTimes.size !== times.length) {
            Alert.alert("Invalid times", "Each dose must have a different time.");
            return;
        }
        setIsSaving(true);
        try {
            // Safety-net sort: times are sorted by handleTimeChange and handleFrequencyChange,
            // but an explicit final sort ensures correctness if any code path is ever missed.
            const sortedTimes = [...times].sort(
                (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
            );
            const existing = await getMedicines();
            await saveMedicines([
                ...existing,
                { id: Date.now().toString(), name: medicineName.trim(), times: sortedTimes },
            ]);
            setMedicineName("");
            setFrequency(1);
            setTimes(DEFAULT_TIMES[1]);
            setPickerIndex(-1);
            router.back();
        } catch {
            Alert.alert("Error", "Failed to save. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

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
                        <Ionicons name="chevron-back" size={20} color="#2563eb" />
                        <Text style={styles.backText}>Back</Text>
                    </Pressable>

                    {/* Header */}
                    <View style={styles.headerRow}>
                        <View style={styles.headerIconBg}>
                            <Ionicons name="add-circle" size={28} color="#2563eb" />
                        </View>
                        <View>
                            <Text style={styles.title}>Add Medicine</Text>
                            <Text style={styles.subtitle}>Schedule a new reminder</Text>
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

                                {/* Inline picker for iOS; dialog for Android */}
                                {pickerIndex === i && (
                                    <DateTimePicker
                                        value={doseTimeToDate(dt)}
                                        mode="time"
                                        display={Platform.OS === "ios" ? "spinner" : "default"}
                                        onChange={(_, date) => handleTimeChange(i, date)}
                                    />
                                )}

                                {i < times.length - 1 && <View style={styles.divider} />}
                            </View>
                        ))}
                    </View>

                    {/* Hint */}
                    <View style={styles.hintCard}>
                        <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
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
                        onPress={handleAdd}
                        disabled={!canSubmit || isSaving}
                    >
                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        <Text style={styles.primaryBtnText}>
                            {isSaving ? "Saving…" : "Add Medicine"}
                        </Text>
                    </Pressable>

                    {/* Cancel */}
                    <Pressable
                        style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => {
                            setMedicineName('');
                            setFrequency(1);
                            setTimes(DEFAULT_TIMES[1]);
                            router.back();
                        }}
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
    backText: { fontSize: 15, color: "#2563eb", fontWeight: "600" },

    headerRow: {
        flexDirection: "row", alignItems: "center",
        gap: 14, marginBottom: 24, marginTop: 4,
    },
    headerIconBg: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center",
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

    // Name input
    inputWrapper: {
        flexDirection: "row", alignItems: "center",
        backgroundColor: "#f9fafb", borderWidth: 1.5,
        borderColor: "#e5e7eb", borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 12, marginBottom: 18,
    },
    inputFocused: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 15, color: "#1f2937" },

    // Frequency selector
    freqRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
    freqBtn: {
        flex: 1, alignItems: "center", paddingVertical: 12,
        borderRadius: 12, borderWidth: 1.5, borderColor: "#e5e7eb",
        backgroundColor: "#f9fafb",
    },
    freqBtnActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
    freqBtnText: { fontSize: 14, fontWeight: "700", color: "#6b7280" },
    freqBtnTextActive: { color: "#1d4ed8" },
    freqBtnSub: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
    freqBtnSubActive: { color: "#3b82f6" },
    freqBtnDisabled: { opacity: 0.4 },

    // Dose time rows
    timeRow: {
        flexDirection: "row", alignItems: "center",
        paddingVertical: 12, paddingHorizontal: 4, borderRadius: 10,
    },
    timeRowActive: { backgroundColor: "#eff6ff" },
    doseLabel: {
        backgroundColor: "#2563eb", borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 3, marginRight: 10,
    },
    doseLabelText: { fontSize: 11, fontWeight: "700", color: "#fff" },
    timeValue: { flex: 1, fontSize: 15, fontWeight: "600", color: "#1f2937" },
    divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 2 },

    // Hint
    hintCard: {
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: "#eff6ff", borderRadius: 12, padding: 12,
        marginBottom: 16, borderLeftWidth: 3, borderLeftColor: "#2563eb",
    },
    hintText: { flex: 1, fontSize: 13, color: "#1e3a8a" },

    // Buttons
    primaryBtn: {
        backgroundColor: "#2563eb", borderRadius: 14, paddingVertical: 15,
        flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 8, marginBottom: 12, shadowColor: "#2563eb",
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
        shadowRadius: 8, elevation: 5,
    },
    primaryBtnDisabled: { backgroundColor: "#93c5fd", shadowOpacity: 0, elevation: 0 },
    primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    ghostBtn: {
        borderRadius: 14, paddingVertical: 14, alignItems: "center",
        backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb",
    },
    ghostBtnText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
});