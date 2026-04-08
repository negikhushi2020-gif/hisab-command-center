import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { type NextRequest, NextResponse } from "next/server";

const DATA_DIR = join(process.cwd(), "data");
const STATE_FILE = join(DATA_DIR, "hisab-state.json");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    
    writeFileSync(STATE_FILE, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true, storage: "file" });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
