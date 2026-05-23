import type { CollectionEntry } from 'astro:content';

export type GalleryEntry = CollectionEntry<'gallery'>;

export interface SortableGalleryEntry {
  id: string;
  data: { order: number };
}

/**
 * Pure-logic singleton for the Gallery component. Keeps the rendering side
 * (`Gallery.astro`) free of business logic so it stays trivial to read.
 */
class GalleryService {
  /**
   * Sorts gallery entries by their `order` field, tie-breaking by `id` so
   * the order is stable across builds when two entries share the same
   * number.
   *
   * @param entries Gallery collection entries
   */
  sortEntries<T extends SortableGalleryEntry>(entries: T[]): T[] {
    return [...entries].sort((a, b) => {
      if (a.data.order !== b.data.order) return a.data.order - b.data.order;
      return a.id.localeCompare(b.id);
    });
  }
}

export default new GalleryService();
