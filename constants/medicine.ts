/** A single dose time. */
export type DoseTime = { hour: number; minute: number; };

export type Medicine = {
    id: string;
    name: string;
    times: DoseTime[];   // 1 | 2 | 3 entries
    createdAt: string;   // ISO 8601 — when this medicine was first added
};

export type TakenLog = {
    id: string;
    medicineId: string;
    medicineName: string;
    timeIndex: number;   // which dose slot (0-based)
    takenAt: string;     // ISO 8601
};
