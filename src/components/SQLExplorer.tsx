import { useState, useCallback } from 'react'
import type { WALogRow } from '../types/wa'
import { WA_LOGS_SCHEMA_COLUMNS } from '../types/wa'
import { runQuery } from '../lib/sqlRunner'

const DEFAULT_QUERY = 'SELECT * FROM wa_logs ORDER BY runtime_ms DESC LIMIT 100'

export function SQLExplorer({ rows }: { rows: WALogRow[] }) {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [result, setResult] = useState<WALogRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(() => {
    const { data, error: err } = runQuery(query, rows)
    setError(err ?? null)
    setResult(data)
  }, [query, rows])

  const insertColumn = (col: string) => {
    setQuery((q) => q + (q.trim().endsWith('wa_logs') ? ' ' : ' ') + col)
  }

  return (
    <>
      <h2 className="section-title">SQL Explorer</h2>
      <p className="section-subtitle">Run queries against the loaded wa_logs table. Only SELECT from wa_logs is supported (ORDER BY, LIMIT).</p>

      <div className="sql-layout">
        <div className="schema-panel">
          <h3>Schema</h3>
          <p className="hint">Click column to insert into query</p>
          <div className="schema-columns">
            {WA_LOGS_SCHEMA_COLUMNS.map((col) => (
              <button key={col} type="button" onClick={() => insertColumn(col)}>
                {col}
              </button>
            ))}
          </div>
        </div>
        <div className="query-panel">
          <h3>SQL Query</h3>
          <p className="tip">Tip: Press Ctrl/Cmd+Enter to run</p>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                run()
              }
            }}
            spellCheck={false}
          />
          <div className="run-row">
            <span className="table-ref">Table: wa_logs</span>
            <button type="button" className="btn-run" onClick={run}>
              Run Query
            </button>
          </div>
        </div>
      </div>

      {error && <div className="errors">{error}</div>}

      <div className="sql-results table-card">
        <h3>Results ({result.length} rows)</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {result.length > 0 &&
                  (WA_LOGS_SCHEMA_COLUMNS as readonly string[]).map((col) => (
                    <th key={col}>{col}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {result.slice(0, 500).map((row, i) => (
                <tr key={i}>
                  {WA_LOGS_SCHEMA_COLUMNS.map((col) => {
                    const v = (row as unknown as Record<string, unknown>)[col]
                    const display = v == null ? '—' : typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : String(v)
                    return (
                      <td key={col} title={typeof v === 'string' ? v : undefined}>
                        {display}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.length > 500 && <p style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Showing first 500 of {result.length} rows.</p>}
      </div>
    </>
  )
}
