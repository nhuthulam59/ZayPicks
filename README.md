# ZayFind

A website that searches your Google Sheet live. Type any word and it shows
every matching row — across **all tabs and all columns** — with Title,
Category, Details and Link. New rows you add in the Sheet appear on the site
automatically, without rebuilding or redeploying.

Built with Next.js 14 (App Router). No database, no secret keys in the code.

## How the live Sheet connection works

The site reads the Sheet at runtime on the server, on every page load, via
the API route `GET /api/search` (see `lib/sheets.js`).

There are two methods — the site picks the first one that is configured:

| Method | Setup | Tabs |
|---|---|---|
| **A. Public CSV export (default, no key needed)** | Share the Sheet as "Anyone with the link can view" (see step 4 below). | Reads the tabs listed in `SHEET_TABS` (default: `Sheet1`). Add new tab names there, comma-separated. |
| **B. Google Sheets API (optional)** | Set `GOOGLE_API_KEY` (see below). The Sheet must still be shared as "Anyone with the link can view". | Discovers **all** tabs automatically — no `SHEET_TABS` needed. |

No password, service-account file or secret is stored in the code. The only
values are environment variables: `SHEET_ID`, `SHEET_TABS`, and optionally
`GOOGLE_API_KEY`.

If the Sheet is not shared yet, the site does **not** crash — it shows a
friendly message telling the visitor to share the Sheet (Share → Anyone with
the link → Viewer) and press Refresh.

### The Sheet used for the demo

- Title: **Search Data**
- Sheet ID: `1JrBzwAVpbBuImQuN8bhHyXBupjN324bpPgXtZ4cfXN4`
- URL: https://docs.google.com/spreadsheets/d/1JrBzwAVpbBuImQuN8bhHyXBupjN324bpPgXtZ4cfXN4/edit
- Contents: `Sheet1` — header row `Title | Category | Details | Link` plus
  55 demo rows across Electronics, Fashion, Home, Beauty, Sports and Books.

To use a different Sheet, just change `SHEET_ID` (and `SHEET_TABS`) — no code
change is needed.

### Optional: Google API key (method B)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a
   project → **APIs & Services → Library** → enable **Google Sheets API**.
2. **APIs & Services → Credentials** → Create Credentials → **API key**.
   Restrict it to the Google Sheets API if you like.
3. Set `GOOGLE_API_KEY` to that key (in `.env.local` locally, and in Vercel —
   see step 5). Leave `SHEET_TABS` unset; all tabs are discovered automatically.

## 1. Run it on your computer (optional)

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 — you should see the 55 demo rows. If the Sheet
is not shared yet, you will see the "not readable yet" message instead.

## 2. Put the code on GitHub

1. On GitHub, create a **new public repository** (for example `zayfind`).
   Do **not** initialise it with a README — leave it empty.
2. Upload this whole folder to that repository (GitHub web upload, or):
   ```bash
   git init
   git add .
   git commit -m "ZayFind website"
   git branch -M main
   git remote add origin https://github.com/<your-username>/zayfind.git
   git push -u origin main
   ```
   `.gitignore` already excludes `node_modules/`, `.next/` and `.env.local`,
   so no secrets or build files are uploaded.

## 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project** →
   **Import** your new GitHub repository.
2. Leave the defaults (Framework: Next.js, Build Command: `npm run build`).
3. Before deploying, add the environment variable (see step 4 below):
   **Settings → Environment Variables** — or add it on the import screen:
   - Name: `SHEET_ID`
   - Value: `1JrBzwAVpbBuImQuN8bhHyXBupjN324bpPgXtZ4cfXN4`
   - (Optional) `SHEET_TABS` = `Sheet1` — add more tab names comma-separated
     when you add tabs to the Sheet. Not needed if you use `GOOGLE_API_KEY`.
4. Click **Deploy**. Vercel gives you a live URL like
   `https://zayfind.vercel.app`.

Every future `git push` to GitHub redeploys the site automatically.

## 4. Make the Sheet readable (required — do this first if search shows nothing)

1. Open the Sheet:
   https://docs.google.com/spreadsheets/d/1JrBzwAVpbBuImQuN8bhHyXBupjN324bpPgXtZ4cfXN4/edit
2. Click **Share** (top right) → under **General access** change
   "Restricted" to **Anyone with the link** → set the role to **Viewer** →
   **Done**.
   - Alternative: **File → Share → Publish to web** → Publish.
   - Viewer access is enough — nobody can edit your Sheet from the website.
3. Open your live site and press **Refresh**. The rows should appear.
   If they do not, check the message on the page — it repeats these steps.

## 5. Using it day to day

- **Add a row:** add it in the Google Sheet. It appears on the site after a
  page reload / Refresh — no code change, no redeploy.
- **Add a new tab:** add the tab name to `SHEET_TABS` in Vercel
  (Settings → Environment Variables → Redeploy), or set `GOOGLE_API_KEY`
  once and new tabs are picked up automatically.
- **Search:** any word in any column matches — title, category, details,
  link, or any other column you add. Category chips filter by category.
- **Change the Sheet:** change `SHEET_ID` in Vercel and redeploy.

## Project structure

```
app/
  layout.jsx          Site title / metadata
  page.jsx            Homepage: search bar, category chips, results grid
  globals.css         All styling (mobile-first, no framework)
  api/search/route.js API route — reads the Sheet live, filters by ?q=
lib/
  sheets.js           Sheet reading (CSV export + Sheets API), CSV parser
.env.example          Environment variables to set (copy to .env.local)
next.config.mjs       Next.js config
package.json          Scripts: dev / build / start
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "The Sheet is not readable yet" | Do step 4 above (Share → Anyone with the link → Viewer), then Refresh. |
| Only Sheet1 shows, new tab missing | Add the tab name to `SHEET_TABS` in Vercel and redeploy, or set `GOOGLE_API_KEY`. |
| Site builds but shows 0 rows | The Sheet is empty or only has a header row — add rows below the header. |
| `SHEET_ID is not set` | Set `SHEET_ID` in Vercel Environment Variables and redeploy. |
