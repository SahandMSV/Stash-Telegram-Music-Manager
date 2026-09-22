import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  const workerPort = process.env.WORKER_PORT ?? "4001";
  try {
    const res = await fetch(
      `http://localhost:${workerPort}/internal/auth/logout`,
      { method: "POST" },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
