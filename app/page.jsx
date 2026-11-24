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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allResults.filter((r) => {
      if (category !== "All" && r.category !== category) return false;
      if (!q) return true;
      return [r.tab, r.title, r.category, r.details, ...Object.values(r.fields || {})]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [allResults, query, category]);

  // Live suggestions: as soon as you type, matching rows appear under the
  // search box. No Enter key, no button press needed.
  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return filtered.slice(0, 8);
  }, [query, filtered]);

  function openInSheet(r) {
    // Clicking a result never opens the row's Link column.
    // It opens the Google Sheet itself, with that exact row selected.
    if (r.sheetUrl) {
      window.open(r.sheetUrl, "_blank", "noopener,noreferrer");
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
      openInSheet(suggestions[activeIndex]);
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
              <div className="suggestions" role="listbox" aria-label="Matching rows">
                {suggestions.map((r, i) => (
                  <button
                    key={`${r.tab}-${r.row}-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    className={i === activeIndex ? "suggestion active" : "suggestion"}
                    onMouseDown={(e) => { e.preventDefault(); openInSheet(r); }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className="suggestion-title">{r.title || "Untitled row"}</span>
                    <span className="suggestion-meta">
                      {r.category ? `${r.category} · ` : ""}{r.tab}{r.row ? ` · Row ${r.row}` : ""} — Sheet-এ দেখুন ↗
                    </span>
                    {r.details && <span className="suggestion-details">{r.details}</span>}
                  </button>
                ))}
                {filtered.length > suggestions.length && (
                  <div className="suggestion-more">আরও {filtered.length - suggestions.length}টি মিল আছে — নিচে সব দেখুন ↓</div>
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
                    <div className="card-foot">
                      <span className="card-tab">{r.tab ? `Sheet: ${r.tab}` : "Google Sheet"}</span>
                      {r.sheetUrl ? (
                        <button className="open-link" type="button" onClick={() => openInSheet(r)}>
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
