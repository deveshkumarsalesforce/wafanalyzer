# WA Log Analyzer

A web application for analyzing **Web Adapter (WA)** log files from **Salesforce Commerce Cloud** (formerly Demandware). Upload pipe-delimited WA logs to explore traffic, performance, cache behavior, and request drilldown—all in the browser with no data sent to a server.

## What it does

- **Analysis** — KPIs (total requests, unique sessions, unique IPs, cache hit rate, error rate), charts (slowest pages, traffic by hour, status codes, cache performance), runtime percentiles, and a table of the slowest requests.
- **Request Drilldown** — Main requests (level-0) with include counts; expand any row to see its includes and timing.
- **URL Analysis** — Top URLs by request count and by average runtime.
- **SQL Explorer** — Run simple queries against the loaded data (e.g. `SELECT * FROM wa_logs ORDER BY runtime_ms DESC LIMIT 100`). Click schema columns to insert into the query.

All processing is client-side; your log data never leaves your machine.

## Supported log format

The app expects **pipe-delimited** WA logs (one line per request, fields separated by `|`), as produced by Salesforce Commerce Cloud / Demandware Web Adapter.

- Skip lines that don’t look like log entries (e.g. “Opening up …”).
- Accepted file extensions: `.log`, `.json`, `.jsonl` (pipe-delimited content is detected and parsed).

Example line shape (simplified):

```
timestamp|remote_ip||server_name|port|runtime_ms|path_query|...|session_id|request_id|response_source|status_code|...
```

Main requests are identified by `request_id` ending with `-0-00`. Cache is inferred from `response_source` (`pc` = page cache HIT).

## How to use

### 1. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Load a log file

- **Drag and drop** a WA log file onto the upload area, or  
- Click **New Upload** and choose a file.

After parsing, the dashboard shows the four tabs: **Analysis**, **Request Drilldown**, **URL Analysis**, **SQL Explorer**.

### 3. Use the tabs

- **Analysis** — Overview metrics, charts, and “Top 50 Slowest Individual Requests” table.
- **Request Drilldown** — Main requests table; use **► Expand** on rows with includes to see sub-requests and timing.
- **URL Analysis** — Bar charts for top URLs by count and by average runtime.
- **SQL Explorer** — Edit the query (e.g. change `ORDER BY` or `LIMIT`), click **Run Query** or press **Ctrl/Cmd+Enter**. Click a column name in the schema to insert it into the query.

### 4. Clear or replace data

- **Clear Memory** — Removes loaded data and resets the app.
- **New Upload** — Opens the file picker to load another log (replaces current data).

### 5. Sample file

Use `wa-log-sample.log` in this repo to try the app without your own logs.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start development server (default: http://localhost:5173) |
| `npm run build` | Production build (output in `dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Tech stack

- **React 18** + **TypeScript**
- **Vite**
- **Recharts** for charts
- No backend; runs entirely in the browser

## Data and privacy

- Data is kept only in memory and is lost when you close the tab or refresh.
- No log content is sent to any server; parsing and analysis happen locally.

## License

Use and modify as needed for your project. Check the repo for any added license file.
