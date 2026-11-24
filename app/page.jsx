"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [allResults, setAllResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) {
        setError(data);
        setAllResults([]);
        return;
      }
      setAllResults(data.results || []);
      setCategories(data.categories || []);
      setTabs(data.tabs || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError({ error: "Could not reach the server. Please reload the page.", hint: "" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allResults.filter((r) => {
      if (category !== "All" && r.category !== category) return false;
      if (!q) return true;
      return [r.tab, r.title, r.category, r.details, r.link, ...Object.values(r.fields || {})]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [allResults, query, category]);

  return (
    <>
      <header className="header">
        <h1>ZayFind</h1>
        <p>Search any word across your Google Sheet — every tab, every column — and see the matching rows instantly. New rows you add in the Sheet appear here automatically.</p>
      </header>

      <main className="container">
        <div className="search-box">
          <div className="search-row">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything — e.g. headphones, cotton, yoga…"
              aria-label="Search the sheet"
              autoFocus
            />
            {query && (
              <button className="clear-btn" onClick={() => setQuery("")} type="button">Clear ✕</button>
            )}
            <button className="refresh-btn" onClick={load} type="button">↻ Refresh</button>
          </div>

          {categories.length > 0 && (
            <div className="chips">
              {["All", ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={category === c ? "chip active" : "chip"}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && <p className="meta">Loading rows from the Google Sheet…</p>}

        {error && (
          <div className="notice" style={{ marginTop: 16 }}>
            <h2>The Sheet is not readable yet</h2>
            <p>{error.error}</p>
            {error.hint && <p>{error.hint}</p>}
            <ol>
              <li>Open the Google Sheet.</li>
              <li>Click <strong>Share</strong> → General access → <strong>Anyone with the link</strong> → <strong>Viewer</strong> → Done. (Or File → Share → Publish to web.)</li>
              <li>Come back here and press <strong>Refresh</strong>. No rebuild or redeploy is needed.</li>
            </ol>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="meta">
              <strong>{filtered.length}</strong> of {total} rows
              {tabs.length > 0 && <> · Tabs: {tabs.join(", ")}</>}
              {query && <> · for “{query}”</>}
              {category !== "All" && <> · Category: {category}</>}
            </p>

            {filtered.length === 0 ? (
              <div className="empty">
                No matching rows found.
                <br />Try a different word, clear the search, or pick “All” categories.
              </div>
            ) : (
              <div className="grid">
                {filtered.map((r, i) => (
                  <article className="card" key={`${r.tab}-${r.title}-${i}`}>
                    <div className="badges">
                      {r.category && <span className="badge">{r.category}</span>}
                      {r.tab && <span className="badge tab">Tab: {r.tab}</span>}
                    </div>
                    <h3>{r.title || "Untitled row"}</h3>
                    {r.details && <p className="details">{r.details}</p>}
                    {r.link ? (
                      <a className="open-link" href={r.link} target="_blank" rel="noopener noreferrer">Open link ↗</a>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        Data is read live from your Google Sheet on every load — add a row in the Sheet, press Refresh, and it appears here.
      </footer>
    </>
  );
}
