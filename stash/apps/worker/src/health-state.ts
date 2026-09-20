import type { WorkerHealthStatus } from "shared-types";

const state: WorkerHealthStatus = {
  workerAlive: true,
  telegramConnected: false,
  listeners: [],
  indexingInProgress: false,
};

export function getHealth(): WorkerHealthStatus {
  return state;
}

export function setTelegramConnected(connected: boolean): void {
  state.telegramConnected = connected;
}

export function setIndexingInProgress(inProgress: boolean): void {
  state.indexingInProgress = inProgress;
}

export function upsertListener(
  chatId: string,
  active: boolean,
  lastCheckedAt: number | null,
): void {
  const existing = state.listeners.find((l) => l.chatId === chatId);
  if (existing) {
    existing.active = active;
    existing.lastCheckedAt = lastCheckedAt;
  } else {
    state.listeners.push({ chatId, active, lastCheckedAt });
  }
}
