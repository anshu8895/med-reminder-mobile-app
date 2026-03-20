import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const STORAGE_KEY = "emergency_contacts";

type Contact = {
    id: string;
    name: string;
    phone: string;
};

/** Unicode-safe first character for avatar initials. */
function getInitial(name: string): string {
    const cp = name.codePointAt(0);
    return cp ? String.fromCodePoint(cp).toUpperCase() : "?";
}

export default function EmergencyContactsScreen() {
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [adding, setAdding] = useState(false);
    // editingId: null → add mode, string → edit mode
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) setContacts(JSON.parse(raw));
        } catch {
            Alert.alert("Error", "Failed to load contacts.");
        }
    }

    async function persist(updated: Contact[]) {
        setContacts(updated);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    function resetForm() {
        setName("");
        setPhone("");
        setAdding(false);
        setEditingId(null);
    }

    function openAddForm() {
        setEditingId(null);
        setName("");
        setPhone("");
        setAdding(true);
    }

    function openEditForm(contact: Contact) {
        setEditingId(contact.id);
        setName(contact.name);
        setPhone(contact.phone);
        setAdding(true);
    }

    async function saveContact() {
        const trimName = name.trim();
        const trimPhone = phone.trim();

        if (!trimName || !trimPhone) {
            Alert.alert("Missing Info", "Please enter both a name and phone number.");
            return;
        }

        // Basic phone validation — strip non-digits and check minimum length
        const phoneDigits = trimPhone.replace(/\D/g, "");
        if (phoneDigits.length < 7) {
            Alert.alert("Invalid Number", "Please enter a valid phone number (at least 7 digits).");
            return;
        }

        if (editingId) {
            // Edit existing
            const updated = contacts.map((c) =>
                c.id === editingId ? { ...c, name: trimName, phone: trimPhone } : c
            );
            await persist(updated);
        } else {
            // Add new
            const newContact: Contact = {
                id: Date.now().toString(),
                name: trimName,
                phone: trimPhone,
            };
            await persist([...contacts, newContact]);
        }
        resetForm();
    }

    function confirmDelete(id: string, contactName: string) {
        Alert.alert(
            "Remove Contact",
            `Remove ${contactName} from emergency contacts?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        await persist(contacts.filter((c) => c.id !== id));
                    },
                },
            ]
        );
    }

    function callNumber(phone: string) {
        const url = `tel:${phone}`;
        Linking.canOpenURL(url).then((supported) => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Alert.alert("Cannot Call", "This device cannot make phone calls.");
            }
        });
    }

    const formTitle = editingId ? "Edit Contact" : "New Contact";

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
                    <Ionicons name="chevron-back" size={22} color="#1f2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Emergency Contacts</Text>
            </View>

            <FlatList
                data={contacts}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="people-outline" size={56} color="#d1d5db" />
                        <Text style={styles.emptyText}>No emergency contacts yet.</Text>
                        <Text style={styles.emptySubText}>Tap "Add Contact" below to get started.</Text>
                    </View>
                }
                ListFooterComponent={
                    <View>
                        {adding ? (
                            <View style={styles.form}>
                                <Text style={styles.formTitle}>{formTitle}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Full name (e.g. Dr. Smith)"
                                    placeholderTextColor="#9ca3af"
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Phone number"
                                    placeholderTextColor="#9ca3af"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                                <View style={styles.formBtns}>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.saveBtn} onPress={saveContact}>
                                        <Text style={styles.saveBtnText}>
                                            {editingId ? "Save Changes" : "Save Contact"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
                                <Ionicons name="person-add-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.addBtnText}>Add Contact</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardInfo}>
                            <View style={styles.avatar}>
                                {/* Unicode-safe initial */}
                                <Text style={styles.avatarText}>{getInitial(item.name)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.contactName}>{item.name}</Text>
                                <Text style={styles.contactPhone}>{item.phone}</Text>
                            </View>
                        </View>
                        <View style={styles.cardActions}>
                            <TouchableOpacity
                                style={styles.callBtn}
                                onPress={() => callNumber(item.phone)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="call" size={20} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={styles.callBtnText}>Call</Text>
                            </TouchableOpacity>
                            {/* Edit button */}
                            <TouchableOpacity
                                style={styles.editBtn}
                                onPress={() => openEditForm(item)}
                                hitSlop={8}
                            >
                                <Ionicons name="pencil-outline" size={20} color="#2563eb" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={() => confirmDelete(item.id, item.name)}
                                hitSlop={8}
                            >
                                <Ionicons name="trash-outline" size={20} color="#dc2626" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
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
    listContent: { padding: 16, paddingBottom: 40 },
    empty: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },
    emptyText: { fontSize: 18, fontWeight: "600", color: "#6b7280", marginTop: 16 },
    emptySubText: { fontSize: 15, color: "#9ca3af", marginTop: 8, textAlign: "center" },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 3,
    },
    cardInfo: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#fecaca",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    avatarText: { fontSize: 22, fontWeight: "700", color: "#dc2626" },
    contactName: { fontSize: 20, fontWeight: "700", color: "#1f2937" },
    contactPhone: { fontSize: 17, color: "#4b5563", marginTop: 2 },
    cardActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    callBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#dc2626",
        borderRadius: 12,
        paddingVertical: 14,
        minHeight: 60,
    },
    callBtnText: { fontSize: 18, fontWeight: "700", color: "#fff" },
    editBtn: {
        width: 48,
        height: 60,
        borderRadius: 12,
        backgroundColor: "#eff6ff",
        alignItems: "center",
        justifyContent: "center",
    },
    deleteBtn: {
        width: 48,
        height: 60,
        borderRadius: 12,
        backgroundColor: "#fef2f2",
        alignItems: "center",
        justifyContent: "center",
    },
    form: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 3,
    },
    formTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 14 },
    input: {
        borderWidth: 1.5,
        borderColor: "#e5e7eb",
        borderRadius: 10,
        padding: 14,
        fontSize: 17,
        color: "#1f2937",
        marginBottom: 12,
        backgroundColor: "#f9fafb",
    },
    formBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
    cancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: "#f3f4f6",
        alignItems: "center",
    },
    cancelBtnText: { fontSize: 16, fontWeight: "600", color: "#6b7280" },
    saveBtn: {
        flex: 2,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: "#dc2626",
        alignItems: "center",
    },
    saveBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    addBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#dc2626",
        borderRadius: 14,
        paddingVertical: 16,
        minHeight: 60,
    },
    addBtnText: { fontSize: 18, fontWeight: "700", color: "#fff" },
});
