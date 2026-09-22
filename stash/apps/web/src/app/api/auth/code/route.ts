import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const workerPort = process.env.WORKER_PORT ?? "4001";
  try {
    const body = await req.json();
    const res = await fetch(
      `http://localhost:${workerPort}/internal/auth/code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
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
