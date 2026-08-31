/**
 * Turns one braindump's text into candidate chunks the user can tap to split
 * off as separate items. Pure text logic - no DOM, no React - so it is cheap
 * to test directly and reusable from any UI that wants it.
 */

export type Segment = { id: number; start: number; end: number; text: string };

// Sentence and clause boundaries, plus line breaks. Runs of punctuation
// ("...", ",, ") collapse into a single boundary rather than producing
// empty segments between them.
const BOUNDARY = /[.!?;,]+|\n+/g;

export function segmentText(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushSegment = (from: number, to: number) => {
    const raw = text.slice(from, to);
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const start = from + leading;
    const end = to - trailing;
    if (end > start) segments.push({ id: segments.length, start, end, text: text.slice(start, end) });
  };

  BOUNDARY.lastIndex = 0;
  while ((match = BOUNDARY.exec(text))) {
    pushSegment(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  pushSegment(cursor, text.length);

  return segments;
}

// Selected segments combine in the order they appear in the note, not the
// order the user tapped them - so tapping segment 2 then segment 0 still
// reads naturally.
export function joinSelected(segments: Segment[], selectedIds: ReadonlySet<number>): string {
  return segments
    .filter((segment) => selectedIds.has(segment.id))
    .map((segment) => segment.text)
    .join(" ");
}
