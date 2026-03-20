import { openDB as idbOpenDB, type IDBPDatabase } from 'idb';
import type { ClassifierModel } from '$lib/classifier/model';
import type { DrumId } from '$lib/player/samples';

export interface KitSettings {
  confidenceThreshold: number;
}

export interface SavedKit {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  surfaceNames: string[];
  model: ClassifierModel;
  mapping: Record<string, DrumId>;
  settings: KitSettings;
}

const DB_NAME = 'no2drummer';
const DB_VERSION = 1;
const KITS_STORE = 'kits';

function openDB(): Promise<IDBPDatabase> {
  return idbOpenDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(KITS_STORE)) {
        db.createObjectStore(KITS_STORE, { keyPath: 'id' });
      }
    }
  });
}

export async function saveKit(kit: SavedKit): Promise<void> {
  const db = await openDB();
  await db.put(KITS_STORE, kit);
}

export async function loadKit(id: string): Promise<SavedKit | null> {
  const db = await openDB();
  const result = await db.get(KITS_STORE, id);
  return (result as SavedKit) ?? null;
}

export async function deleteKit(id: string): Promise<void> {
  const db = await openDB();
  await db.delete(KITS_STORE, id);
}

export async function listKits(): Promise<
  Array<{ id: string; name: string; updatedAt: number; surfaceNames: string[] }>
> {
  const db = await openDB();
  const all = (await db.getAll(KITS_STORE)) as SavedKit[];
  return all
    .map((kit) => ({
      id: kit.id,
      name: kit.name,
      updatedAt: kit.updatedAt,
      surfaceNames: kit.surfaceNames
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function hasAnySavedKit(): Promise<boolean> {
  const db = await openDB();
  const count = await db.count(KITS_STORE);
  return count > 0;
}
