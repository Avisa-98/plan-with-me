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
