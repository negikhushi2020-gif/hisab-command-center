import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { kv } from "@vercel/kv";
import { type NextRequest, NextResponse } from "next/server";

const DATA_DIR = join(process.cwd(), "data");
const STATE_FILE = join(DATA_DIR, "hisab-state.json");
const KV_STATE_KEY = "hisab:state";

export const dynamic = "force-dynamic";

const hasKvConfig = () =>
  Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const kvGetState = async () => {
  const raw = await kv.get<string>(KV_STATE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
};

const kvSetState = async (value: unknown) => {
  await kv.set(KV_STATE_KEY, JSON.stringify(value));
};

export async function GET() {
  try {
    if (hasKvConfig()) {
      return NextResponse.json(await kvGetState());
    }

    if (!existsSync(STATE_FILE)) {
      return NextResponse.json(null);
    }
    const raw = readFileSync(STATE_FILE, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (hasKvConfig()) {
      await kvSetState(body);
      return NextResponse.json({ ok: true, storage: "kv" });
    }

    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(STATE_FILE, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true, storage: "file" });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
