const attempts = new Map<string, number>();
const LOCKOUT_MS = 30_000;

export function isLockedOut(key: string): boolean {
  const lockedUntil = attempts.get(key);
  if (!lockedUntil) return false;
  if (Date.now() > lockedUntil) {
    attempts.delete(key);
    return false;
  }
  return true;
}

export function registerFailure(key: string): void {
  attempts.set(key, Date.now() + LOCKOUT_MS);
}

export function clearFailure(key: string): void {
  attempts.delete(key);
}
