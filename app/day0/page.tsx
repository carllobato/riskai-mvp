"use client";

import { useState } from "react";

type Risk = {
  id: string;
  title: string;
  category: string;
  probability: number;   // 1–5
  consequence: number;   // 1–5
  inherentRating: number; // prob * cons
  status: "Open" | "Closed";
};

export default function Day0Page() {
  const [documentText, setDocumentText] = useState("");
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExtract() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/extract-risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }

      setRisks(data.risks || []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Day 0 — Risk Extraction</h1>

      <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
        Paste document text
      </label>

      <textarea
        value={documentText}
        onChange={(e) => setDocumentText(e.target.value)}
        rows={10}
        style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #ccc" }}
        placeholder="Paste a paragraph from a risk register, report, email, etc."
      />

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={onExtract}
          disabled={loading || documentText.trim().length === 0}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #222",
            background: loading ? "#ddd" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Extracting…" : "Extract risks"}
        </button>

        {error && <span style={{ color: "crimson" }}>{error}</span>}
      </div>

      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>Extracted risks</h2>

      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Title", "Category", "P", "C", "Inherent", "Status"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderBottom: "1px solid #ddd",
                    fontSize: 13,
                    color: "#333",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {risks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, color: "#666" }}>
                  No risks yet.
                </td>
              </tr>
            ) : (
              risks.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.title}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.category}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.probability}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.consequence}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.inherentRating}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}