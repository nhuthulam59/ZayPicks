import { loadSheet, searchResults } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  try {
    const { tabs, results } = await loadSheet();
    const filtered = searchResults(results, q);
    const categories = [...new Set(results.map((r) => r.category).filter(Boolean))].sort();
    return Response.json({
      ok: true,
      total: results.length,
      count: filtered.length,
      tabs,
      categories,
      results: filtered,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        code: err.code || "sheet_error",
        error: err.message || "Could not read the Google Sheet.",
        hint:
          err.code === "missing_sheet_id"
            ? "Set SHEET_ID in Vercel (Project Settings -> Environment Variables) and redeploy."
            : "In Google Sheets: Share -> General access -> Anyone with the link (Viewer), or File -> Share -> Publish to web. Then reload this page. No rebuild is needed — the site reads the Sheet live on every search.",
      },
      { status: err.code === "missing_sheet_id" ? 500 : 502 }
    );
  }
}
