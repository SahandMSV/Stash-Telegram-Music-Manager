export interface Track {
  id: string;
  telegramMessageId: number;
  chatId: string;
  senderId: string;
  senderName: string;
  title: string;
  performer: string;
  album: string | null;
  duration: number;
  mimeType: string;
  fileSize: number;
  fileReference: string;
  accessHash: string;
  documentId: string;
  originalDate: number;
  isDownloaded: boolean;
  downloadedPath: string | null;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  originalDeleted: boolean;
  lastSeenAt: number;
}

export interface Chat {
  id: string;
  title: string;
  type: "private" | "group" | "channel" | "saved";
  musicCount: number | null;
  indexed: boolean;
  listenerEnabled: boolean;
  listenerLastCheckedAt: number | null;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistTrack {
  id: string;
  playlistId: string;
  trackId: string;
  position: number;
}

export type IndexingPace = "conservative" | "aggressive";

export interface Settings {
  id: "singleton";
  maxGbPerDay: number;
  maxConcurrentDownloads: number;
  maxChatsPerRun: number;
  defaultHistoryDepthDays: number | null;
  listenerConcurrency: number;
  indexingPace: IndexingPace;
  theme: "light" | "dark" | "system";
}

export interface SyncState {
  chatId: string;
  lastIndexedMessageId: number;
  listenerActive: boolean;
  lastListenerCheckAt: number | null;
}

export type WorkerHealthStatus = {
  workerAlive: boolean;
  telegramConnected: boolean;
  listeners: {
    chatId: string;
    active: boolean;
    lastCheckedAt: number | null;
  }[];
  indexingInProgress: boolean;
};
