import type { Bucket, Item, StoredData } from "./storage";
import { isIdea, isLater, isMonthItem, isUnresolved, isWeekItem } from "./views.ts";

/**
 * A read-only, human-readable copy of everything - separate from
 * exportData/parseImport, which stay the actual backup/restore format.
 * This is for reading, printing, or dropping into a plain-text notes app
 * like Obsidian: real markdown checklists, nothing that needs this app to
 * make sense of, and no attempt to be re-imported.
 *
 * Any section with nothing in it is left out entirely, rather than printing
 * an empty heading - a real file a person reads shouldn't have those.
 */

function formatMinutes(minutes?: number) {
  if (!minutes) return undefined;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ""}` : `${rest}m`;
}

// One line per task: a checkbox, the text, then whatever of
// category/estimate/due date is actually set, in parentheses - and no
// parentheses at all if none of them are.
function taskLine(item: Item): string {
  const box = item.done ? "[x]" : "[ ]";
  const details = [item.category, formatMinutes(item.estimateMinutes), item.dueDate ? `due ${item.dueDate}` : undefined]
    .filter((part): part is string => !!part)
    .join(" · ");
  return `- ${box} ${item.text}${details ? ` (${details})` : ""}`;
}

function bucketSection(title: string, items: Item[], bucket: Bucket | undefined): string | null {
  const inBucket = items.filter((item) => item.bucket === bucket);
  if (inBucket.length === 0) return null;
  return `## ${title}\n${inBucket.map((item) => taskLine(item)).join("\n")}`;
}

export function exportMarkdown(data: StoredData): string {
  const sections: string[] = [`# Bunko — Backup\nExported ${new Date().toLocaleDateString()}`];

  const ideas = data.items.filter(isIdea);
  if (ideas.length > 0) {
    sections.push(`## Idea Log\n${ideas.map((item) => `- ${item.text}`).join("\n")}`);
  }

  const committed = data.items.filter((item) => isWeekItem(item) || isMonthItem(item) || isLater(item));
  for (const [title, bucket] of [["Today", "Today"], ["This Week", "This Week"], ["This Month", "This Month"], ["Later", "Later"]] as const) {
    const section = bucketSection(title, committed, bucket);
    if (section) sections.push(section);
  }

  const inbox = data.items.filter(isUnresolved);
  if (inbox.length > 0) {
    sections.push(`## Inbox\n${inbox.map((item) => `- ${item.text}`).join("\n")}`);
  }

  if (sections.length === 1) {
    sections.push("Nothing captured yet.");
  }

  return sections.join("\n\n") + "\n";
}
