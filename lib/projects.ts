import type { Category, Item, Project } from "./storage";

/**
 * Pure logic for projects: which items belong to one, how much time they
 * add up to, and keeping done projects visible but out of the way - same
 * "sink to the bottom, don't disappear" idea already used for done items.
 */

export function subtasksOf(projectId: string, items: Item[]): Item[] {
  return items.filter((item) => item.projectId === projectId);
}

// Includes done subtasks too, since this is "how much total is this
// project," not "how much is left."
export function subtaskTotalMinutes(projectId: string, items: Item[]): number {
  return subtasksOf(projectId, items).reduce((sum, item) => sum + (item.estimateMinutes ?? 0), 0);
}

export function sortProjectsDoneLast(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => Number(a.done) - Number(b.done));
}

// A subtask never carries its own category - the category always comes from
// its project, however that item's own `category` field happens to be set
// (stale data left over, for instance, from before it belonged to a
// project). A standalone item with no project keeps its own category as
// normal.
export function effectiveCategory(item: Item, projects: Project[]): Category | undefined {
  if (!item.projectId) return item.category;
  return projects.find((project) => project.id === item.projectId)?.category;
}
