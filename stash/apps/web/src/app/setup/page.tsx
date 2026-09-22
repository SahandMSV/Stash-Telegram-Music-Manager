"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type AuthStatus = {
  phase: string;
  connected: boolean;
  userId: string | null;
  username: string | null;
  firstName: string | null;
  error: string | null;
  floodSecondsRemaining?: number | null;
  attempt?: number;
  maxAttempts?: number;
};

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status");
      const data = (await res.json()) as AuthStatus;
      setStatus(data);
      return data;
    } catch {
      setStatus(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const id = setInterval(() => void refreshStatus(), 2000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "failed to start");
      } else if (data.error) {
        setError(data.error);
      }
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "invalid code");
        setCode("");
        await refreshStatus();
      } else {
        const s = await refreshStatus();
        if (s?.connected) {
          router.push("/");
          router.refresh();
        } else {
          setCode("");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "invalid password");
        setPassword("");
        await refreshStatus();
      } else {
        const s = await refreshStatus();
        if (s?.connected) {
          router.push("/");
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleStartOver() {
    setResetting(true);
    setError(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setPhone("");
      setCode("");
      setPassword("");
      await refreshStatus();
    } finally {
      setResetting(false);
    }
  }

  if (status?.connected) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="flex flex-col gap-4 w-full max-w-sm p-6 text-center">
          <h1 className="text-xl font-semibold">Already connected</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {status.username
              ? `@${status.username}`
              : (status.firstName ?? status.userId)}
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="bg-black text-white rounded px-4 py-2"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const phase = status?.phase ?? "idle";
  const floodLeft = status?.floodSecondsRemaining ?? null;
  const blockedByFlood = floodLeft !== null && floodLeft > 0;
  const attempt = status?.attempt ?? 0;
  const maxAttempts = status?.maxAttempts ?? 0;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex flex-col gap-4 w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold text-center">Connect Telegram</h1>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        {status?.error && !error && (
          <p className="text-red-500 text-sm text-center">{status.error}</p>
        )}
        {blockedByFlood && (
          <p className="text-amber-600 dark:text-amber-400 text-sm text-center">
            Telegram rate limit active. Wait {floodLeft}s before trying again.
          </p>
        )}
        {(phase === "awaiting_code" || phase === "awaiting_password") &&
          attempt > 0 && (
            <p className="text-zinc-500 text-xs text-center">
              Attempt {attempt} of {maxAttempts}
            </p>
          )}

        {(phase === "idle" || phase === "error") && (
          <form onSubmit={handleStart} className="flex flex-col gap-3">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Phone number (international format)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1234567890"
              className="border rounded px-3 py-2"
              autoFocus
              required
              disabled={blockedByFlood}
            />
            <button
              type="submit"
              disabled={loading || !phone.trim() || blockedByFlood}
              className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {loading ? "Sending code…" : "Send code"}
            </button>
          </form>
        )}

        {phase === "awaiting_code" && (
          <form onSubmit={handleCode} className="flex flex-col gap-3">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Login code from Telegram
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="border rounded px-3 py-2 text-center text-xl tracking-widest"
              autoFocus
              required
              disabled={blockedByFlood}
            />
            <button
              type="submit"
              disabled={loading || !code.trim() || blockedByFlood}
              className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Submit code"}
            </button>
          </form>
        )}

        {phase === "awaiting_password" && (
          <form onSubmit={handlePassword} className="flex flex-col gap-3">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Two-factor password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded px-3 py-2"
              autoFocus
              required
              disabled={blockedByFlood}
            />
            <button
              type="submit"
              disabled={loading || !password || blockedByFlood}
              className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Submit password"}
            </button>
          </form>
        )}

        {phase === "connecting" && (
          <p className="text-center text-zinc-500">Connecting…</p>
        )}

        {(phase === "awaiting_code" || phase === "awaiting_password") && (
          <button
            type="button"
            onClick={handleStartOver}
            disabled={resetting}
            className="border border-zinc-300 dark:border-zinc-700 rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            {resetting ? "Resetting…" : "Start over"}
          </button>
        )}
      </div>
    </div>
  );
}
