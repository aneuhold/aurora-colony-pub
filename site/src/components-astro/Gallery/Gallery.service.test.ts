import { describe, expect, it } from 'vitest';
import galleryService, { type SortableGalleryEntry } from './Gallery.service';

const makeEntry = (id: string, order: number): SortableGalleryEntry => ({
  id,
  data: { order }
});

describe('GalleryService.sortEntries', () => {
  it('sorts by order ascending', () => {
    const entries = [makeEntry('c', 2), makeEntry('a', 0), makeEntry('b', 1)];
    expect(galleryService.sortEntries(entries).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('tie-breaks equal orders by id', () => {
    const entries = [makeEntry('c', 0), makeEntry('a', 0), makeEntry('b', 0)];
    expect(galleryService.sortEntries(entries).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const entries = [makeEntry('b', 1), makeEntry('a', 0)];
    const original = entries.map((e) => e.id);
    galleryService.sortEntries(entries);
    expect(entries.map((e) => e.id)).toEqual(original);
  });
});
