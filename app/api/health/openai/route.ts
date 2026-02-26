export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { ok: false, status: 500, hint: "missing key" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
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
