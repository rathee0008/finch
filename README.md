# Finch

A local-first personal finance manager. Accounts, budgets, cash-flow forecasting, and debt payoff planning — running entirely in your browser, with your data stored only on your own machine.

No account, no server, no telemetry. Nothing is ever uploaded anywhere.

![License](https://img.shields.io/badge/license-MIT-blue) ![React](https://img.shields.io/badge/React-19-149eca) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![Vite](https://img.shields.io/badge/Vite-8-646cff)

---

## Features

### Money

- **Accounts** — checking, savings, credit, cash, investment and loan accounts, with balances that update automatically from every transaction.
- **Transactions** — search, multi-filter (date, account, category, type, tag, cleared state), sort, and bulk edit. Select many at once to recategorize, tag, mark cleared, or delete.
- **Split transactions** — divide a single purchase across several categories, with a validator that won't let the splits drift out of balance. Budgets and reports are all split-aware.
- **Transfers** — move money between accounts without polluting income or expense totals.
- **Reconciliation** — mark transactions cleared or pending, and filter to whatever hasn't settled yet.

### Planning

- **Budgets** — monthly limits per category, with optional rollover that carries unspent room into the next month, and one-click copying of last month's setup.
- **Goals** — savings targets with progress tracking and a projection of when you'll actually get there based on your monthly contribution.
- **Recurring** — track rent, subscriptions and paychecks on any cadence, post them when due, and let them drive the forecast.
- **Recurring detection** — scans your history for repeating charges you aren't tracking yet and offers to track them.

### Insight

- **Dashboard** — net worth, income, spend and savings rate, each with a sparkline, plus an insights engine that surfaces category spikes against your 3-month average, budget overruns, unusual transactions, and projected shortfalls in plain language.
- **Cash flow forecast** — projects your liquid balance forward 30–180 days from recurring items plus your real average daily spending. Flags the projected low point and warns before you'd run short.
- **Debt payoff planner** — avalanche vs. snowball simulation with per-account APR and minimums. Shows your debt-free date, total interest, and how much interest and time you'd save versus paying minimums only.
- **Reports** — income vs. expenses, net worth over time, a daily spending heatmap, category breakdowns and top payees across 3, 6 or 12 months.

### Automation

- **Rules** — match a payee by contains / starts-with / exact / regex, then auto-assign a category, clean up messy bank descriptions, and apply tags. Runs on new and imported transactions, with a live preview of what a rule will catch and a backfill for existing records.
- **CSV import** — auto-detects common bank export layouts, including separate debit/credit columns, parenthesised negatives, and both `D/M/YYYY` and `M/D/YYYY` dates.
- **CSV / JSON export** — export any filtered view, or a full backup you can restore later.

### Interface

- Command palette (<kbd>⌘K</kbd>) across pages, actions, accounts and transactions
- Full undo / redo history (<kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd>)
- Light and dark themes, eight accent colors, comfortable and compact density
- Keyboard shortcuts throughout — press <kbd>?</kbd> for the full list
- Responsive down to mobile

---

## Getting started

```bash
git clone https://github.com/rathee0008/finch.git
cd finch
npm install
npm run dev
```

Open http://localhost:5173.

The app starts with a realistic sample dataset so every screen is immediately useful. When you're ready to use your own numbers, go to **Settings → Danger zone → Delete everything**.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |

---

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| <kbd>⌘K</kbd> | Command palette |
| <kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd> | Undo / redo |
| <kbd>N</kbd> | New transaction |
| <kbd>/</kbd> | Focus search |
| <kbd>⌘B</kbd> | Collapse sidebar |
| <kbd>⌘D</kbd> | Toggle dark mode |
| <kbd>G</kbd> then <kbd>D</kbd>/<kbd>T</kbd>/<kbd>A</kbd>/<kbd>B</kbd>/<kbd>R</kbd> | Jump to Dashboard / Transactions / Accounts / Budgets / Reports |
| <kbd>?</kbd> | Show all shortcuts |

---

## Your data

Everything lives in your browser's `localStorage` under a single key. That means:

- **It never leaves your device.** There is no backend to send it to.
- **It's per-browser.** Your data won't follow you to another browser or machine unless you export and restore it.
- **Clearing site data deletes it.** Use **Settings → Export backup** regularly, which downloads a JSON file you can restore at any time.

---

## Tech

React 19 · TypeScript · Vite · Tailwind CSS v4 · Recharts · lucide-react

No backend, no database, no external API calls. All financial logic — forecasting, amortization, budget rollover, recurring detection — is implemented locally in `src/lib/`.

```
src/
├── lib/              # Pure logic: calculations, forecast, debt, rules, insights, csv
├── context/          # Finance state with undo/redo history, toasts
├── components/       # Pages and UI primitives
└── types.ts          # Shared data model
```

---

## Disclaimer

Finch is a personal bookkeeping and planning tool. Its forecasts and payoff projections are estimates based on the numbers you enter, not financial advice. For decisions that matter, talk to a qualified advisor.

## License

MIT — see [LICENSE](LICENSE).
