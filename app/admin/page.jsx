"use client";

import { useEffect, useState } from "react";

// Minimal admin landing page: shows the spreadsheets currently connected
// to ZayFind (read live from /api/search). Sheet IDs are managed in
// Vercel, not from this page — changing them here is a later step.
export default function Admin() {
  const [sheets, setSheets] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/search", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) { setError(data); return; }
        setSheets(data.sheets || []);
        setTabs(data.tabs || []);
        setTotal(data.total || 0);
        const c = {};
        (data.results || []).forEach((r) => { c[r.sheetId] = (c[r.sheetId] || 0) + 1; });
        setCounts(c);
      })
      .catch(() => setError({ error: "Could not reach the server. Please reload the page.", hint: "" }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-mark">Z</span>
            <span className="logo-name">ZayFind</span>
          </div>
          <a href="/" className="admin-btn">← Back to search</a>
        </div>
      </header>

      <main className="container">
        <h1 style={{ fontSize: 20, margin: "4px 2px 0" }}>Admin Panel</h1>
        <p className="meta">Connected spreadsheets — the same sheets the search reads live.</p>

        {loading && <p className="loading">Loading connected sheets…</p>}

        {error && (
          <div className="notice" style={{ marginTop: 16 }}>
            <h2>The Sheet is not readable yet</h2>
            <p>{error.error}</p>
            {error.hint && <p>{error.hint}</p>}
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="meta">
              <strong>{sheets.length}</strong> sheet{sheets.length === 1 ? "" : "s"} · <strong>{total}</strong> rows total
              {tabs.length > 0 ? ` · Tabs: ${tabs.join(", ")}` : ""}
            </p>

            {sheets.length === 0 ? (
              <div className="empty">No spreadsheet connected yet. Set SHEET_ID in Vercel and redeploy.</div>
            ) : (
              <div className="grid">
                {sheets.map((s) => (
                  <article className="card" key={s.id}>
                    <div className="badges">
                      <span className="badge">{counts[s.id] || 0} rows</span>
                    </div>
                    <h3>{s.name}</h3>
                    <p className="details" style={{ wordBreak: "break-all" }}>{s.id}</p>
                  </article>
                ))}
              </div>
            )}

            <div className="notice" style={{ marginTop: 16 }}>
              <h2>How to add another sheet</h2>
              <p>Sheet IDs are managed in Vercel — they cannot be changed from this page yet.</p>
              <ol>
                <li>Share the new Sheet as <strong>Anyone with the link</strong> → <strong>Viewer</strong>.</li>
                <li>In Vercel → ZayPicks → Settings → Environment Variables, add its ID to <strong>SHEET_IDS</strong> (comma-separated).</li>
                <li>Optionally give it a button name in <strong>SHEET_NAMES</strong> (same order as SHEET_IDS).</li>
                <li>Redeploy — the new sheet button appears in the header automatically.</li>
              </ol>
            </div>
          </>
        )}
      </main>

      <footer className="footer">ZayFind — Search your Google Sheet, live.</footer>
    </>
  );
}
