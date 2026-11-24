"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [allResults, setAllResults] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchWrapRef = useRef(null);

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

  // Close the suggestions dropdown when tapping/clicking outside it.
  useEffect(() => {
    function onDocClick(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Cell-level search on the device too: a word matches when it appears in
  // ANY box of the row — Title, Category, Details, Link, or any other
  // column — and the matching boxes are attached so the UI can show them.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allResults
      .map((r) => {
        if (category !== "All" && r.category !== category) return null;
        if (!q) return { ...r, matchedCells: [] };
        const cells = (r.cells || []).filter((c) => String(c.value || "").toLowerCase().includes(q));
        const haystack = (
          r.searchText ||
          [r.tab, r.title, r.category, r.details, r.link, ...Object.values(r.fields || {})].join(" ")
        ).toLowerCase();
        if (cells.length === 0 && !haystack.includes(q)) return null;
        return { ...r, matchedCells: cells };
      })
      .filter(Boolean);
  }, [allResults, query, category]);

  // Live suggestions, one per matching BOX (not just one per row): as soon
  // as you type, every cell that contains the word appears under the
  // search box, showing its own text, column and row. No Enter key needed.
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const entries = [];
    for (const r of filtered) {
      const matched = r.matchedCells && r.matchedCells.length > 0 ? r.matchedCells : null;
      if (matched) {
        for (const cell of matched) {
          entries.push({ row: r, cell, key: `${r.tab}-${r.row}-${cell.letter}` });
        }
      } else {
        // Matched on the tab name itself: show the row once.
        entries.push({ row: r, cell: null, key: `${r.tab}-${r.row}-row` });
      }
      if (entries.length >= 10) break;
    }
    return entries;
  }, [query, filtered]);
  const totalSuggestions = useMemo(() => {
    if (!query.trim()) return 0;
    return filtered.reduce(
      (n, r) => n + (r.matchedCells && r.matchedCells.length > 0 ? r.matchedCells.length : 1),
      0
    );
  }, [query, filtered]);

  function openInSheet(r, cell) {
    // Clicking a result never opens the row's Link column.
    // It opens the Google Sheet itself — at the exact BOX that matched,
    // or at the row when there is no single matching box.
    const url = (cell && cell.url) || r.sheetUrl;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setShowSuggestions(false);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      const s = suggestions[activeIndex];
      openInSheet(s.row, s.cell);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <span className="header-left">Google Sheet Search</span>
          <div className="logo">
            <span className="logo-mark">Z</span>
            <span className="logo-name">ZayFind</span>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="search-box">
          <div className="search-row" ref={searchWrapRef} style={{ position: "relative", flex: 1, display: "flex", gap: 8 }}>
            <div className="search-field">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); setActiveIndex(-1); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={onKeyDown}
                placeholder="Search anything — e.g. headphones, cotton, yoga…"
                aria-label="Search the sheet"
                autoFocus
                autoComplete="off"
              />
            </div>
            {query && (
              <button className="clear-btn" onClick={() => { setQuery(""); setShowSuggestions(false); }} type="button">Clear ✕</button>
            )}
            <button className="refresh-btn" onClick={load} type="button">↻ Refresh</button>

            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions" role="listbox" aria-label="Matching cells">
                {suggestions.map((s, i) => (
                  <button
                    key={s.key}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    className={i === activeIndex ? "suggestion active" : "suggestion"}
                    onMouseDown={(e) => { e.preventDefault(); openInSheet(s.row, s.cell); }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="suggestion-title">
                      {s.cell ? s.cell.value : s.row.title || "Untitled row"}
                    </span>
                    <span className="suggestion-meta">
                      {s.cell
                        ? `${s.cell.column} · Row ${s.row.row} · ${s.row.tab} — ওই ঘরটিতে যান ↗`
                        : `${s.row.tab}${s.row.row ? ` · Row ${s.row.row}` : ""} — Sheet-এ দেখুন ↗`}
                    </span>
                    {s.cell && s.row.title && s.cell.value !== s.row.title && (
                      <span className="suggestion-details">{s.row.title}</span>
                    )}
                    {!s.cell && s.row.details && <span className="suggestion-details">{s.row.details}</span>}
                  </button>
                ))}
                {totalSuggestions > suggestions.length && (
                  <div className="suggestion-more">আরও {totalSuggestions - suggestions.length}টি মিল আছে — নিচে সব দেখুন ↓</div>
                )}
              </div>
            )}
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

        {loading && <p className="loading">Loading rows from the Google Sheet…</p>}

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
            </p>

            {filtered.length === 0 ? (
              <div className="empty">
                No matching rows found.
                <br />Try a different word, clear the search, or pick “All” categories.
              </div>
            ) : (
              <div className="grid">
                {filtered.map((r, i) => (
                  <article className="card" key={`${r.tab}-${r.row || r.title}-${i}`}>
                    <div className="badges">
                      {r.category && <span className="badge">{r.category}</span>}
                      {r.row ? <span className="badge row">Row {r.row}</span> : null}
                    </div>
                    <h3>{r.title || "Untitled row"}</h3>
                    {r.details && <p className="details">{r.details}</p>}
                    {query.trim() && r.matchedCells && r.matchedCells.length > 0 && (
                      <div className="match">
                        {r.matchedCells.slice(0, 3).map((c) => (
                          <p key={c.letter} className="match-line">
                            <strong>{c.column}:</strong> {c.value}
                          </p>
                        ))}
                      </div>
                    )}
                    <div className="card-foot">
                      <span className="card-tab">{r.tab ? `Sheet: ${r.tab}` : "Google Sheet"}</span>
                      {r.sheetUrl ? (
                        <button
                          className="open-link"
                          type="button"
                          onClick={() =>
                            openInSheet(
                              r,
                              query.trim() && r.matchedCells && r.matchedCells[0]
                                ? r.matchedCells[0]
                                : null
                            )
                          }
                        >
                          View in Sheet ↗
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="footer">
        ZayFind — Search your Google Sheet, live.
      </footer>
    </>
  );
}
