import { Medicine } from "../../constants/medicine";
import { AdherenceLevel, MedReliability, MissRisk } from "./types";

// ─── Date utilities ───────────────────────────────────────────────────────────

/** Local midnight, `daysAgo` days back from today. */
export function localDayStart(daysAgo: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
}

/**
 * Locale-safe local date key ("YYYY-MM-DD").
 * Uses getFullYear/Month/Date (local time) — no toLocaleDateString to avoid
 * device-locale formatting differences on Android.
 */
export function localDateKey(date: Date): string {
    return (
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0")
    );
}

/**
 * Returns true if the medicine's creation date (local time) is on or before
 * `dayStart` (also local time). Uses date-string comparison to be correct
 * across all UTC± timezones.
 */
export function medExistedOn(createdAt: string, dayStart: Date): boolean {
    return localDateKey(new Date(createdAt)) <= localDateKey(dayStart);
}

// ─── Adherence level ──────────────────────────────────────────────────────────

export function getAdherenceLevel(pct: number): AdherenceLevel {
    if (pct >= 80) return { color: "#16a34a", bg: "#f0fdf4", label: "Excellent" };
    if (pct >= 50) return { color: "#d97706", bg: "#fffbeb", label: "Fair" };
    return { color: "#dc2626", bg: "#fef2f2", label: "Low" };
}

// ─── Streak ───────────────────────────────────────────────────────────────────

/**
 * Counts ONLY logs for medicines that existed on each historical day
 * (createdAt filter), preventing later-added medicines from inflating
 * earlier days' taken counts.
 */
export function computeStreakFromLogs(
    medDayIndex: Map<string, Map<string, number>>,
    medicines: Medicine[],
    todayComplete: boolean
): number {
    if (medicines.length === 0) return 0;

    let streak = todayComplete ? 1 : 0;

    for (let daysAgo = 1; daysAgo <= 365; daysAgo++) {
        const dayStart = localDayStart(daysAgo);
        const key = localDateKey(dayStart);

        const existingMeds = medicines.filter((m) => medExistedOn(m.createdAt, dayStart));
        if (existingMeds.length === 0) break;

        const expectedOnDay = existingMeds.reduce((sum, m) => sum + (m.times?.length ?? 0), 0);
        const takenOnDay = existingMeds.reduce(
            (sum, m) => sum + (medDayIndex.get(m.id)?.get(key) ?? 0),
            0
        );

        if (takenOnDay >= expectedOnDay) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

// ─── Insight message ──────────────────────────────────────────────────────────

export function buildInsightMessage(thisWeek: boolean[], lastWeek: boolean[]): string {
    if (thisWeek.length === 0) return "";
    const pct = (arr: boolean[]) =>
        arr.length ? Math.round((arr.filter(Boolean).length / arr.length) * 100) : 0;
    const tw = pct(thisWeek);
    const lw = pct(lastWeek);
    if (tw > lw) return `Up ${tw - lw}% vs last week — great work!`;
    if (tw < lw) return `Down ${lw - tw}% vs last week — keep going!`;
    return `Same adherence as last week (${tw}%)`;
}

// ─── Miss risk ────────────────────────────────────────────────────────────────

/**
 * Uses logSet for O(1) per-dose lookups; respects createdAt.
 * logSet entries: "medicineId-timeIndex-YYYY-MM-DD"
 */
export function computeMissRisk(logSet: Set<string>, medicines: Medicine[]): MissRisk | null {
    if (medicines.length === 0) return null;

    const missByHour: Record<number, number> = {};

    for (let daysAgo = 1; daysAgo <= 27; daysAgo++) {
        const dayStart = localDayStart(daysAgo);
        const dayKey = localDateKey(dayStart);

        for (const med of medicines) {
            if (!medExistedOn(med.createdAt, dayStart)) continue;
            for (let i = 0; i < (med.times?.length ?? 0); i++) {
                if (!logSet.has(`${med.id}-${i}-${dayKey}`)) {
                    const h = med.times[i].hour;
                    missByHour[h] = (missByHour[h] ?? 0) + 1;
                }
            }
        }
    }

    if (Object.keys(missByHour).length === 0) return null;
    const topEntry = Object.entries(missByHour).reduce((a, b) => (b[1] > a[1] ? b : a));
    if (topEntry[1] < 2) return null;

    const h = parseInt(topEntry[0], 10);
    return { slot: h < 12 ? "morning" : h < 17 ? "afternoon" : "evening", missCount: topEntry[1] };
}

// ─── Per-medicine reliability ─────────────────────────────────────────────────

/**
 * Per-medicine reliability over last 27 completed days.
 * Uses two-level medDayIndex for O(1) taken-count lookups and
 * logSet for per-dose miss-slot detection.
 * Medicines added < 1 day ago are excluded (expected === 0).
 */
export function computeReliability(
    logSet: Set<string>,
    medDayIndex: Map<string, Map<string, number>>,
    medicines: Medicine[]
): MedReliability[] {
    return medicines
        .map((med) => {
            let taken = 0;
            let expected = 0;
            const missByHour: Record<number, number> = {};

            for (let daysAgo = 1; daysAgo <= 27; daysAgo++) {
                const dayStart = localDayStart(daysAgo);
                if (!medExistedOn(med.createdAt, dayStart)) continue;
                const dayKey = localDateKey(dayStart);

                const timesLen = med.times?.length ?? 0;
                expected += timesLen;
                const takenCount = medDayIndex.get(med.id)?.get(dayKey) ?? 0;
                taken += Math.min(takenCount, timesLen);

                for (let i = 0; i < timesLen; i++) {
                    if (!logSet.has(`${med.id}-${i}-${dayKey}`)) {
                        const h = med.times[i].hour;
                        missByHour[h] = (missByHour[h] ?? 0) + 1;
                    }
                }
            }

            if (expected === 0) return null;

            const pct = Math.round((taken / expected) * 100);
            const stars = pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1;

            let missedSlot: string | null = null;
            const entries = Object.entries(missByHour);
            if (entries.length > 0) {
                const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
                if (top[1] >= 2) {
                    const h = parseInt(top[0], 10);
                    missedSlot = h < 12 ? "Mornings" : h < 17 ? "Afternoons" : "Evenings";
                }
            }

            return { id: med.id, name: med.name, adherencePct: pct, missedSlot, stars };
        })
        .filter(Boolean) as MedReliability[];
}
