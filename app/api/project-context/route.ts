import { NextResponse } from "next/server";
import { parseProjectContext } from "@/lib/projectContext";
import { setProjectContext } from "@/lib/getProjectContext";

/**
 * POST: Sync project context from client (same data as Project Information page).
 * Body: ProjectContext. Validates and caches server-side for optional use.
 * Client persists to localStorage; this endpoint is optional sync.
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = parseProjectContext(body);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid project context" }, { status: 400 });
    }
    setProjectContext(parsed);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
