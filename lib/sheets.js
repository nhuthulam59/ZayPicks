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
    return {
      tab,
      row: rowNumber,
      // Opens the Google Sheet with this exact row selected/highlighted.
      // The tab name is in the range, so it lands on the right tab too.
      sheetUrl: sheetId
        ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid || 0}&range=${encodeURIComponent(tab)}!A${rowNumber}:Z${rowNumber}`
        : "",
      title: pick(row, headers, ["Title", "Name", "Item", "Product"]) || String(row[0] || ""),
      category: pick(row, headers, ["Category", "Type", "Group"]),
      details: pick(row, headers, ["Details", "Description", "Notes", "Info"]),
      link: pick(row, headers, ["Link", "URL", "Url"]),
      fields,
    };
  }).filter((r) => Object.values(r.fields).some((v) => String(v).trim() !== ""));
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
  if (!q) return results;
  return results.filter((r) =>
    [r.tab, r.title, r.category, r.details, r.link, ...Object.values(r.fields)]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}
