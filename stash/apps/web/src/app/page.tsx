"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AuthStatus = {
  phase: string;
  connected: boolean;
  userId: string | null;
  username: string | null;
  firstName: string | null;
  error: string | null;
};

export default function Home() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data: AuthStatus) => setStatus(data))
      .catch(() => setStatus(null));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setStatus({
        phase: "idle",
        connected: false,
        userId: null,
        username: null,
        firstName: null,
        error: null,
      });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-8">
      <main className="flex flex-col gap-6 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-center">Stash</h1>

        {status === null && (
          <p className="text-center text-zinc-500">Checking connection…</p>
        )}

        {status && !status.connected && (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">
              Telegram account not connected.
            </p>
            <Link
              href="/setup"
              className="bg-black text-white rounded px-4 py-2 text-center"
            >
              Connect account
            </Link>
          </div>
        )}

        {status?.connected && (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">
              Connected as{" "}
              <span className="font-medium text-black dark:text-white">
                {status.username
                  ? `@${status.username}`
                  : (status.firstName ?? status.userId)}
              </span>
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="border border-zinc-300 dark:border-zinc-700 rounded px-4 py-2 disabled:opacity-50"
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
