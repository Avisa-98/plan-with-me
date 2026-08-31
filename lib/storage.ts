export type Category = "Work" | "Family" | "Friends" | "Health" | "Personal";
export type Bucket = "Today" | "This Week" | "Later";
export type ItemStatus = "Inbox" | "Planned";
// Undefined means task - every item captured before this field existed, and
// every new capture until someone chooses otherwise, is a task with no
// migration needed.
export type ItemType = "task" | "idea";

export type Item = {
  id: string;
  text: string;
  status: ItemStatus;
  type?: ItemType;
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

// Two renames normalized here:
// - "Unprocessed" (the old status value) -> "Inbox"
// - "Entertainment" (the old category name) -> "Personal", both on items
//   and on any weekly target key set for it
// Anything saved before either rename still has the old string sitting in
// someone's browser or an old backup file - this fixes both on the way in,
// so nothing is silently left with a value the current app no longer
// recognizes, and nothing (an item, a target) disappears because of it.
function migrate(data: StoredData): StoredData {
  // Only touch the specific field that needs fixing, on only the items that
  // need it - spreading in a key unconditionally (even set to undefined)
  // would add it to items that never had it, which is a different object
  // shape than the original, not merely a fixed value.
  const items = data.items.map((item) => {
    const fix: Partial<Item> = {};
    if ((item.status as string) === "Unprocessed") fix.status = "Inbox";
    if ((item.category as string) === "Entertainment") fix.category = "Personal";
    return Object.keys(fix).length ? { ...item, ...fix } : item;
  });

  const targets = { ...data.targets } as Record<string, number | undefined>;
  if ("Entertainment" in targets) {
    if (targets.Personal === undefined) targets.Personal = targets.Entertainment;
    delete targets.Entertainment;
  }

  return { ...data, items, targets };
}

export function loadData(): StoredData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as StoredData;
    return migrate({ ...emptyData(), ...parsed });
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
    return migrate({ ...emptyData(), ...parsed });
  } catch {
    return null;
  }
}
