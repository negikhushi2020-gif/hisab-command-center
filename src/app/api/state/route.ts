import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { type NextRequest, NextResponse } from "next/server";

const DATA_DIR = join(process.cwd(), "data");
const STATE_FILE = join(DATA_DIR, "hisab-state.json");

export const dynamic = "force-dynamic";

// ─── GitHub API persistence (free, shared across all devices) ────────────────
const GH_REPO = process.env.GITHUB_REPO;         // e.g. "negikhushi2020-gif/hisab-command-center"
const GH_TOKEN = process.env.GITHUB_TOKEN;        // Personal access token with repo write
const GH_BRANCH = process.env.GITHUB_BRANCH ?? "main";
const GH_FILE = "data/hisab-state.json";
const GH_API = "https://api.github.com";

const hasGithubConfig = () => Boolean(GH_REPO && GH_TOKEN);

const githubHeaders = () => ({
  Authorization: `token ${GH_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "Content-Type": "application/json",
});

async function githubGetFile(): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(
    `${GH_API}/repos/${GH_REPO}/contents/${GH_FILE}?ref=${GH_BRANCH}`,
    { headers: githubHeaders(), cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json() as { content: string; sha: string };
  return data;
}

async function githubGetState(): Promise<unknown> {
  const file = await githubGetFile();
  if (!file) return null;
  const decoded = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return JSON.parse(decoded);
}

async function githubSetState(value: unknown): Promise<void> {
  const file = await githubGetFile();
  const encoded = Buffer.from(JSON.stringify(value, null, 2)).toString("base64");

  const body: Record<string, unknown> = {
    message: "chore: auto-save business state",
    content: encoded,
    branch: GH_BRANCH,
  };
  if (file?.sha) body.sha = file.sha;

  const res = await fetch(
    `${GH_API}/repos/${GH_REPO}/contents/${GH_FILE}`,
    { method: "PUT", headers: githubHeaders(), body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub API error: ${JSON.stringify(err)}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    if (hasGithubConfig()) {
      const state = await githubGetState();
      return NextResponse.json(state);
    }
    // Local fallback (dev only)
    if (!existsSync(STATE_FILE)) return NextResponse.json(null);
    const raw = readFileSync(STATE_FILE, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(null);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (hasGithubConfig()) {
      await githubSetState(body);
      return NextResponse.json({ ok: true, storage: "github" });
    }

    // Local fallback (dev only)
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ ok: true, storage: "file" });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
