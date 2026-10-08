import { sortNotes, filterByTag, getUniqueTags } from '../../../client/src/utils/note-utils';
import type { LifeNote } from '@shared/api.interface';

function makeNote(overrides: Partial<LifeNote> = {}): LifeNote {
  return {
    id: `note-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Note',
    content: 'content',
    tags: [],
    isPinned: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

describe('note-utils', () => {
  describe('sortNotes', () => {
    it('pinned notes come before unpinned', () => {
      const notes = [
        makeNote({ id: 'a', isPinned: false }),
        makeNote({ id: 'b', isPinned: true }),
      ];
      const result = sortNotes(notes);
      expect(result[0].id).toBe('b');
      expect(result[1].id).toBe('a');
    });

    it('sorts by createdAt descending within same pin status', () => {
      const notes = [
        makeNote({ id: 'old', createdAt: '2024-01-01T00:00:00Z' }),
        makeNote({ id: 'new', createdAt: '2024-01-10T00:00:00Z' }),
      ];
      const result = sortNotes(notes);
      expect(result[0].id).toBe('new');
      expect(result[1].id).toBe('old');
    });

    it('does not mutate original array', () => {
      const notes = [
        makeNote({ id: 'a', isPinned: false }),
        makeNote({ id: 'b', isPinned: true }),
      ];
      const original = [...notes];
      sortNotes(notes);
      expect(notes).toEqual(original);
    });
  });

  describe('filterByTag', () => {
    it('returns all notes when tag is empty', () => {
      const notes = [makeNote({ id: 'a' }), makeNote({ id: 'b' })];
      expect(filterByTag(notes, '')).toHaveLength(2);
    });

    it('filters notes by matching tag', () => {
      const notes = [
        makeNote({ id: 'a', tags: ['work', 'idea'] }),
        makeNote({ id: 'b', tags: ['personal'] }),
        makeNote({ id: 'c', tags: ['work'] }),
      ];
      const result = filterByTag(notes, 'work');
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id).sort()).toEqual(['a', 'c']);
    });

    it('returns empty when no notes match tag', () => {
      const notes = [makeNote({ tags: ['work'] })];
      expect(filterByTag(notes, 'nonexistent')).toHaveLength(0);
    });
  });

  describe('getUniqueTags', () => {
    it('returns unique sorted tags across all notes', () => {
      const notes = [
        makeNote({ tags: ['zebra', 'apple'] }),
        makeNote({ tags: ['apple', 'banana'] }),
        makeNote({ tags: [] }),
      ];
      const tags = getUniqueTags(notes);
      expect(tags).toEqual(['apple', 'banana', 'zebra']);
    });

    it('returns empty array for empty notes', () => {
      expect(getUniqueTags([])).toEqual([]);
    });
  });
});
