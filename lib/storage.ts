export type Category = "Work" | "Family" | "Friends" | "Health" | "Entertainment";
export type Bucket = "Today" | "This Week" | "Later";
export type ItemStatus = "Unprocessed" | "Planned";

export type Item = {
  id: string;
  text: string;
  status: ItemStatus;
  bucket?: Bucket;
  category?: Category;
  estimateMinutes?: number;
  effort?: "Low" | "Medium" | "High";
  dueDate?: string;
  eventStart?: string;
  eventEnd?: string;
  project?: string;
  done?: boolean;
  actualMinutes?: number;
  splitFrom?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Reflection = { id: string; type: "daily" | "weekly"; text: string; createdAt: string };
export type Targets = Partial<Record<Category, number>>;
export type StoredData = { deviceKey: string; items: Item[]; reflections: Reflection[]; targets: Targets };

const STORAGE_KEY = "plan-with-me:v1";

export function emptyData(): StoredData {
  return { deviceKey: crypto.randomUUID(), items: [], reflections: [], targets: {} };
}

export function loadData(): StoredData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as StoredData;
    return { ...emptyData(), ...parsed };
  } catch {
    return emptyData();
  }
}

export function saveData(data: StoredData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function makeId() {
  return crypto.randomUUID();
}

// Everything is stored only on this device - Export/Import is the one way
// to move it anywhere else, or protect against clearing site data.
export function exportData(data: StoredData): string {
  return JSON.stringify(data, null, 2);
}

// Same "fill in missing fields, keep everything else" rule loadData uses -
// one place decides what a valid StoredData looks like. Returns null for
// anything that clearly isn't a Plan With Me backup, so the caller can show
// a plain error instead of silently wiping the current plan.
export function parseImport(raw: string): StoredData | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) return null;
    return { ...emptyData(), ...parsed };
  } catch {
    return null;
  }
}
