export const runtime = "nodejs";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    });

    if (res.ok) {
      return Response.json({ ok: true, status: res.status });
    }
    return Response.json({
      ok: false,
      status: res.status,
      hint: "non-2xx from OpenAI",
    });
  } catch {
    return Response.json(
      { ok: false, status: 0, hint: "fetch failed" },
      { status: 500 }
    );
  }
}
