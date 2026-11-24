// Server-side Google Sheet reading.
// Two Vercel-friendly methods, in order:
//   1. Official Google Sheets API (if GOOGLE_API_KEY is set) — auto-discovers all tabs.
//   2. Public CSV export (gviz) — no key needed, reads the tabs in SHEET_TABS.
// Both need each Sheet shared as "Anyone with the link can view"
// (or File -> Publish to web). No secret is ever hardcoded here.
// Add more spreadsheets with SHEET_IDS (comma-separated IDs) — every one
// of them is searched, all tabs, all columns. SHEET_ID is kept as a
// fallback for a single spreadsheet.

function getConfig() {
  const ids = (process.env.SHEET_IDS || process.env.SHEET_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    sheetIds: ids,
    apiKey: (process.env.GOOGLE_API_KEY || "").trim(),
    tabs: (process.env.SHEET_TABS || "Sheet1")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

// Minimal CSV parser: handles quoted fields, commas and newlines inside quotes.
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// Cell-level search: EVERY cell of the Sheet is searchable — any row, any
// column. Each row carries its full list of cells, so the UI can show
// exactly which box matched and open that exact box in Google Sheets.
function columnLetter(index) {
  // 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB ...
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function pick(row, headers, names) {
  for (const name of names) {
    const idx = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
    if (idx >= 0 && row[idx] != null && String(row[idx]).trim() !== "") return String(row[idx]).trim();
  }
  return "";
}

function rowsToResults(tab, rows, sheetId, gid) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).map((row, i) => {
    const fields = {};
    headers.forEach((h, i) => { if (h) fields[h] = row[i] != null ? String(row[i]) : ""; });
    // Sheet row number: header is row 1, first data row is row 2.
    const rowNumber = i + 2;
    // Every non-empty cell of this row, whatever column it sits in.
    // A column with no header text is NOT dropped — it is kept as
    // "Column E" etc., so data in a headerless column is still searchable.
    const cells = row
      .map((v, colIndex) => {
        const value = v != null ? String(v).trim() : "";
        if (!value) return null;
        const letter = columnLetter(colIndex);
        const column = headers[colIndex] || `Column ${letter}`;
        return {
          column,
          letter,
          value,
          // Deep link to this exact box in the Sheet (single-cell range).
          url: sheetId
            ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid || 0}&range=${letter}${rowNumber}`
            : "",
        };
      })
      .filter(Boolean);
    return {
      tab,
      row: rowNumber,
      // Opens the Google Sheet with this exact row selected/highlighted.
      // NOTE: the range must be plain (A5:Z5) — putting the tab name in it
      // (Sheet1!A5:Z5) makes Google Sheets drop the range and land on A1.
      // The gid already points at the right tab (exact gid in API mode).
      sheetUrl: sheetId
        ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid || 0}&range=A${rowNumber}:Z${rowNumber}`
        : "",
      title: pick(row, headers, ["Title", "Name", "Item", "Product"]) || String(row[0] || ""),
      category: pick(row, headers, ["Category", "Department", "Type", "Group"]),
      details: pick(row, headers, ["Details", "Designation", "Description", "Notes", "Info"]),
      link: pick(row, headers, ["Link", "URL", "Url"]),
      fields,
      // All cells of the row + one joined string the search runs against,
      // so a word in ANY box — Title, Category, Details, Link, or any
      // extra column — matches this row.
      cells,
      searchText: [tab, ...cells.map((c) => c.value)].join(" "),
    };
  }).filter((r) => r.cells.length > 0);
}

async function fetchTabCSV(sheetId, tab) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&headers=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = new Error(`Sheet tab "${tab}" could not be read (HTTP ${res.status})`);
    err.code = "sheet_not_shared";
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    const err = new Error(`Sheet tab "${tab}" is not publicly readable`);
    err.code = "sheet_not_shared";
    err.status = 401;
    throw err;
  }
  return rowsToResults(tab, parseCSV(text), sheetId, 0);
}

async function fetchViaApi(sheetId, apiKey) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" }
  );
  if (!metaRes.ok) {
    const err = new Error(`Google Sheets API could not read the spreadsheet (HTTP ${metaRes.status})`);
    err.code = "sheet_not_shared";
    err.status = metaRes.status;
    throw err;
  }
  const meta = await metaRes.json();
  const tabList = (meta.sheets || []).map((s) => ({ title: s.properties.title, gid: s.properties.sheetId })).filter((t) => t.title);
  const tabs = tabList.map((t) => t.title);
  const all = [];
  for (const tab of tabList) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab.title)}!A1:Z1000?key=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    );
    if (!res.ok) continue;
    const data = await res.json();
    all.push(...rowsToResults(tab.title, data.values || [], sheetId, tab.gid));
  }
  return { tabs, results: all };
}

export async function loadSheet() {
  const { sheetIds, apiKey, tabs } = getConfig();
  if (!sheetIds.length) {
    const err = new Error("SHEET_ID is not set");
    err.code = "missing_sheet_id";
    throw err;
  }
  const allResults = [];
  const allTabs = [];
  for (const sheetId of sheetIds) {
    if (apiKey) {
      const one = await fetchViaApi(sheetId, apiKey);
      allResults.push(...one.results);
      allTabs.push(...one.tabs);
    } else {
      for (const tab of tabs) {
        const tabResults = await fetchTabCSV(sheetId, tab);
        allResults.push(...tabResults);
      }
      allTabs.push(...tabs);
    }
  }
  return { tabs: [...new Set(allTabs)], results: allResults };
}

export function searchResults(results, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return results.map((r) => ({ ...r, matchedCells: [] }));
  return results
    .map((r) => {
      // Which exact boxes contain the searched word?
      const cells = (r.cells || []).filter((c) => c.value.toLowerCase().includes(q));
      const matched =
        cells.length > 0 ||
        (r.searchText || [r.tab, r.title, r.category, r.details, r.link, ...Object.values(r.fields || {})].join(" "))
          .toLowerCase()
          .includes(q);
      if (!matched) return null;
      return { ...r, matchedCells: cells };
    })
    .filter(Boolean);
}
