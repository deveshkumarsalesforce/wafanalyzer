import { useState, Fragment } from 'react'
import type { WALogRow } from '../types/wa'
import { getMainRequests, getIncludesForMain } from '../lib/waStats'

export function TabDrilldown({ rows }: { rows: WALogRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const mains = getMainRequests(rows)
  const totalIncludes = rows.filter((r) => !r.request_id.match(/-0-00\s*$/)).length
  const withIncludes = mains.filter((m) => m.includes > 0).length
  const avgIncludes = mains.length ? (totalIncludes / mains.length) : 0

  return (
    <>
      <h2 className="section-title">Request Drilldown</h2>
      <p className="section-subtitle">
        Click on any main request to see its includes and timing breakdown. Main requests are level-0 requests that may trigger multiple includes.
      </p>

      <div className="kpi-cards">
        <div className="kpi-card" style={{ borderLeftColor: '#2563eb' }}>
          <div className="label">Total Main Requests</div>
          <div className="value" style={{ color: '#2563eb' }}>{mains.length}</div>
        </div>
        <div className="kpi-card purple">
          <div className="label">Requests with Includes</div>
          <div className="value">{withIncludes}</div>
        </div>
        <div className="kpi-card red">
          <div className="label">Total Includes</div>
          <div className="value">{totalIncludes}</div>
        </div>
        <div className="kpi-card green">
          <div className="label">Avg Includes per Request</div>
          <div className="value">{avgIncludes.toFixed(1)}</div>
        </div>
      </div>

      <div className="table-card">
        <h3>Main Requests ({mains.length})</h3>
        <div className="table-wrap">
          <table className="drilldown-table">
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Path</th>
                <th>Runtime (ms)</th>
                <th>Status</th>
                <th>Method</th>
                <th>Includes</th>
                <th>Cache</th>
                <th className="expand-cell">Action</th>
              </tr>
            </thead>
            <tbody>
              {mains.map((m) => (
                <Fragment key={m.request_id}>
                  <tr>
                    <td>{m.request_id}</td>
                    <td title={m.path_query}>{m.path_query.length > 50 ? m.path_query.slice(0, 50) + '…' : m.path_query}</td>
                    <td className={m.runtime_ms > 1000 ? 'runtime-slow' : ''}>{m.runtime_ms}</td>
                    <td className="status-ok">{m.status_code}</td>
                    <td>{m.method}</td>
                    <td className={m.includes > 0 ? 'runtime-slow' : ''}>{m.includes}</td>
                    <td className={m.cacheHit ? 'cache-hit' : 'cache-miss'}>{m.cacheHit ? '✓ HIT' : '✗ MISS'}</td>
                    <td>
                      {m.includes > 0 ? (
                        <button
                          type="button"
                          className="expand-link"
                          onClick={() => setExpandedId(expandedId === m.request_id ? null : m.request_id)}
                        >
                          {expandedId === m.request_id ? '▼ Collapse' : '► Expand'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {expandedId === m.request_id && m.includes > 0 && (
                    <tr key={`${m.request_id}-includes`}>
                      <td colSpan={8} style={{ padding: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid var(--card-border)' }}>
                        <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
                          <strong>Includes ({m.includes}):</strong>
                          <ul style={{ margin: '0.5rem 0 0 1rem', paddingLeft: 0 }}>
                            {getIncludesForMain(rows, m.request_id)
                              .sort((a, b) => b.runtime_ms - a.runtime_ms)
                              .slice(0, 30)
                              .map((inc, i) => (
                                <li key={i} style={{ listStyle: 'none', marginBottom: 4 }}>
                                  <span className={inc.runtime_ms > 500 ? 'runtime-slow' : ''}>{inc.runtime_ms} ms</span>
                                  {' — '}
                                  {inc.path_query.length > 70 ? inc.path_query.slice(0, 70) + '…' : inc.path_query}
                                </li>
                              ))}
                            {m.includes > 30 && <li style={{ listStyle: 'none', color: 'var(--text-muted)' }}>… and {m.includes - 30} more</li>}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
