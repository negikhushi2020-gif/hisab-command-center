import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { type NextRequest, NextResponse } from "next/server";

const DATA_DIR = join(process.cwd(), "data");
const STATE_FILE = join(DATA_DIR, "hisab-state.json");

export const dynamic = "force-dynamic";

// ─── Upstash Redis REST API (free 10K commands/day, no package needed) ───────
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;   // e.g. "https://xyz.upstash.io"
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = "hisab:state";

const hasUpstash = () => Boolean(UPSTASH_URL && UPSTASH_TOKEN);

async function redisGet(): Promise<unknown> {
  const res = await fetch(`${UPSTASH_URL}/get/${REDIS_KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result: string | null };
  if (!data.result) return null;
  return JSON.parse(data.result);
}

async function redisSet(value: unknown): Promise<void> {
  const res = await fetch(`${UPSTASH_URL}/set/${REDIS_KEY}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upstash SET failed: ${err}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. Upstash Redis (production — shared across all devices)
    if (hasUpstash()) {
      const state = await redisGet();
      if (state) return NextResponse.json(state);
      // Upstash empty → seed from committed JSON file
      if (existsSync(STATE_FILE)) {
        const seed = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
        await redisSet(seed).catch(() => {});
        return NextResponse.json(seed);
      }
      return NextResponse.json(null);
    }

    // 2. Local file fallback (dev only)
    if (!existsSync(STATE_FILE)) return NextResponse.json(null);
    return NextResponse.json(JSON.parse(readFileSync(STATE_FILE, "utf-8")));
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Upstash Redis (production)
    if (hasUpstash()) {
      await redisSet(body);
      return NextResponse.json({ ok: true, storage: "upstash" });
    }

    // 2. Local file fallback (dev only)
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true, storage: "file" });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
