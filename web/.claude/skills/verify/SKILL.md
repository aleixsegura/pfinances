---
name: verify
description: Build, run, and drive the Plout web UI to verify changes at the browser surface.
---

# Verifying Plout web/ changes

Vite + React + Tailwind v4 SPA. All commands from `web/` (Node 20, see `.nvmrc`).

## Build / typecheck

```bash
npm run build   # tsc -b && vite build
```

## Run

```bash
npm run dev     # background it; defaults to :5173 but falls back (e.g. :5174) if busy
```

Read the dev-server output for the actual port before opening the browser — the user often has another instance holding 5173, which serves stale code.

## Drive

Use the claude-in-chrome tools on `http://localhost:<port>/`.

Flows worth driving:
- **Dashboard** (landing page `/`): net-worth hero with today/open P/L chips and the value chart, cash accounts, top holdings, spending donut (hover syncs donut ↔ legend), interest sparkline, recent transactions, upcoming dividends (only when `dividends.json` has any). Every card must show its empty state, not crash, when its JSON is missing — rename `watchlists/revolut_transactions.json` to check.
- **Transactions** (`/transactions`): ‹ › month navigation and "All time"; click a bar to open that month; category chips filter the bars and the table; search box; kind filters (All / Expenses / Income / Internal moves — internal rows render greyed); "Show all" after 30 rows; the interest section at the bottom (daily bars, monthly effective rate).
- **Holdings** (`/holdings`): KPI cards, sector donut, stocks table with position columns (Qty/Avg Price/Value €/P/L €/P/L %). Data joins DEGIRO `positions.json` + Revolut; crypto rows (BTC, ETH) have Revolut positions with no cost basis, so P/L cells are `—` — useful for null-handling checks.
- Table sorting: click Type / Market Cap and Qty / Value € / P/L € / P/L % headers; asc → desc toggle, missing values sort last.

## Gotchas

- Tailwind preflight resets `text-transform`/font on `<button>`, so buttons inside styled `<th>`/`<td>` need explicit `uppercase` etc. — inherited-looking styles silently drop.
- Data comes from static JSON exports; no backend to start.
- One palette only (no dark mode): colours come from the tokens in `src/index.css`; canvas charts (lightweight-charts) resolve them once via `getComputedStyle`.
