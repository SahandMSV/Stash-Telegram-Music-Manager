import Dexie, { type Table } from "dexie";
import type {
  Track,
  Chat,
  Playlist,
  PlaylistTrack,
  Settings,
  SyncState,
} from "shared-types";

export class StashDB extends Dexie {
  tracks!: Table<Track, string>;
  chats!: Table<Chat, string>;
  playlists!: Table<Playlist, string>;
  playlistTracks!: Table<PlaylistTrack, string>;
  settings!: Table<Settings, string>;
  syncState!: Table<SyncState, string>;

  constructor() {
    super("stash-db");
    this.version(1).stores({
      tracks:
        "id, chatId, performer, title, isDuplicate, duplicateOfId, isDownloaded, originalDate",
      chats: "id, type, indexed, listenerEnabled",
      playlists: "id, name, updatedAt",
      playlistTracks: "id, playlistId, trackId, position",
      settings: "id",
      syncState: "chatId",
    });
  }
}

export const db = new StashDB();

export const DEFAULT_SETTINGS: Settings = {
  id: "singleton",
  maxGbPerDay: 5,
  maxConcurrentDownloads: 2,
  maxChatsPerRun: 30,
  defaultHistoryDepthDays: null,
  listenerConcurrency: 3,
  indexingPace: "conservative",
  theme: "system",
};

export async function ensureDefaultSettings(): Promise<void> {
  const existing = await db.settings.get("singleton");
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS);
  }
}
