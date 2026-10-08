import type { LifeNote } from '@shared/api.interface';

export function sortNotes(notes: LifeNote[]): LifeNote[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });
}

export function filterByTag(notes: LifeNote[], tag: string): LifeNote[] {
  if (!tag) return notes;
  return notes.filter((n) => n.tags?.includes(tag));
}

export function getUniqueTags(notes: LifeNote[]): string[] {
  const set = new Set<string>();
  for (const n of notes) {
    for (const t of n.tags ?? []) {
      set.add(t);
    }
  }
  return Array.from(set).sort();
}
