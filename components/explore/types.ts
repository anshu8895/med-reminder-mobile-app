import Ionicons from "@expo/vector-icons/Ionicons";

// ─── Types ───────────────────────────────────────────────────────────────────

export type QuickAction = {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
};

export type HealthTip = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    body: string;
};

export type AdherenceLevel = {
    color: string;
    bg: string;
    label: string;
};

export type MissRisk = {
    slot: string;
    missCount: number;
};

export type MedReliability = {
    id: string;
    name: string;
    adherencePct: number;
    missedSlot: string | null;
    stars: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const QUICK_ACTIONS: QuickAction[] = [
    { id: "drug", label: "Drug\nInformation", icon: "medical", color: "#2563eb", bg: "#eff6ff" },
    { id: "interaction", label: "Interaction\nChecker", icon: "flask", color: "#7c3aed", bg: "#f5f3ff" },
    { id: "pharmacy", label: "Find\nPharmacy", icon: "location", color: "#059669", bg: "#ecfdf5" },
    { id: "emergency", label: "Emergency\nContacts", icon: "call", color: "#dc2626", bg: "#fef2f2" },
];

export const HEALTH_TIPS: HealthTip[] = [
    { icon: "sunny", title: "Consistency Is Key", body: "Take medications at the same time each day. A morning alarm improves adherence by up to 80%." },
    { icon: "water", title: "Stay Hydrated", body: "Drink a full glass of water with each dose. Hydration helps your body absorb medications more effectively." },
    { icon: "restaurant", title: "Food & Meds", body: "Some medications work better with food, others on an empty stomach. Always follow your doctor's advice." },
    { icon: "moon", title: "Evening Routine", body: "Pair evening medications with a nightly routine — like brushing your teeth — to anchor the habit." },
    { icon: "notifications", title: "Use Reminders", body: "Multiple reminder channels dramatically reduce missed doses, especially for complex schedules." },
];

export const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
