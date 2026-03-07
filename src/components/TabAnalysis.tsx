import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
} from 'recharts'
import type { WALogRow } from '../types/wa'
import {
  uniqueSessions,
  uniqueIps,
  cacheHitRate,
  errorRate,
  runtimePercentiles,
  topSlowestPages,
  trafficByHour,
  statusCodeDistribution,
  cachePerformance,
  topSlowestRequests,
} from '../lib/waStats'

const COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#ea580c', '#dc2626']

export function TabAnalysis({ rows }: { rows: WALogRow[] }) {
  const total = rows.length
  const sessions = uniqueSessions(rows)
  const ips = uniqueIps(rows)
  const cacheRate = cacheHitRate(rows)
  const errRate = errorRate(rows)
  const percentiles = runtimePercentiles(rows)
  const topSlow = topSlowestPages(rows, 20)
  const byHour = trafficByHour(rows)
  const statusDist = statusCodeDistribution(rows)
  const cachePerf = cachePerformance(rows)
  const slowest50 = topSlowestRequests(rows, 50)

  return (
    <>
      <h2 className="section-title">Analysis</h2>
      <p className="section-subtitle">Overview of traffic, performance, and cache.</p>

      <div className="kpi-cards">
        <div className="kpi-card purple">
          <div className="label">Total Requests</div>
          <div className="value">{total}</div>
        </div>
        <div className="kpi-card green">
          <div className="label">Unique Sessions</div>
          <div className="value">{sessions}</div>
        </div>
        <div className="kpi-card purple">
          <div className="label">Unique IPs</div>
          <div className="value">{ips}</div>
        </div>
        <div className="kpi-card green">
          <div className="label">Cache Hit Rate</div>
          <div className="value">{cacheRate}%</div>
        </div>
        <div className="kpi-card red">
          <div className="label">Error Rate</div>
          <div className="value">{errRate}%</div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Top 20 Slowest Pages (Avg Runtime)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topSlow.slice(0, 20)} margin={{ left: 8, right: 8, bottom: 80 }} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="path" width={200} tick={{ fontSize: 9 }} tickFormatter={(v) => (v.length > 45 ? v.slice(0, 45) + '…' : v)} />
              <Tooltip formatter={(v: number) => [v?.toFixed(0) ?? 0, 'Avg ms']} labelFormatter={(l) => l} />
              <Bar dataKey="avgRuntime" fill="#2563eb" name="Avg Runtime (ms)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Traffic by Hour (UTC)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
              <XAxis type="number" dataKey="hour" name="Hour" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" type="number" dataKey="requests" name="Requests" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" type="number" dataKey="avgRuntime" name="Avg Runtime (ms)" tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number, n: string) => [v, n]} />
              <Scatter yAxisId="left" data={byHour} fill="#2563eb" name="Requests" />
              <Scatter yAxisId="right" data={byHour} fill="#dc2626" name="Avg Runtime (ms)" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Status Code Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusDist}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ status, count }) => `${status}: ${count}`}
              >
                {statusDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Cache Performance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={[{ name: 'Cache Hits', hits: cachePerf.hits, misses: 0 }, { name: 'Cache Misses', hits: 0, misses: cachePerf.misses }]} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => v} />
              <Bar dataKey="hits" fill="#16a34a" name="Hits" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="misses" fill="#dc2626" name="Misses" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1rem', marginTop: 8 }}>
            <span style={{ color: 'var(--ok)' }}>Hits: {cachePerf.hits}</span>
            <span style={{ color: 'var(--miss)' }}>Misses: {cachePerf.misses}</span>
          </div>
        </div>
      </div>

      <div className="percentiles">
        <span>Runtime Percentiles (ms):</span>
        <span>P50: <strong>{percentiles.p50}</strong></span>
        <span>P75: <strong>{percentiles.p75}</strong></span>
        <span>P95: <strong>{percentiles.p95}</strong></span>
        <span>P99: <strong>{percentiles.p99}</strong></span>
        <span>Max: <strong>{percentiles.max}</strong></span>
      </div>

      <div className="table-card">
        <h3>Top 50 Slowest Individual Requests</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Runtime (ms)</th>
                <th>Path</th>
                <th>Status</th>
                <th>Method</th>
                <th>Cache</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {slowest50.map((r, i) => (
                <tr key={i}>
                  <td className={r.runtime_ms > 1000 ? 'runtime-slow' : ''}>{r.runtime_ms}</td>
                  <td title={r.path_query}>{r.path_query.length > 60 ? r.path_query.slice(0, 60) + '…' : r.path_query}</td>
                  <td className="status-ok">{r.status_code}</td>
                  <td>{r.method}</td>
                  <td className={r.response_source?.toLowerCase() === 'pc' ? 'cache-hit' : 'cache-miss'}>
                    {r.response_source?.toLowerCase() === 'pc' ? '✓ HIT' : '✗ MISS'}
                  </td>
                  <td>{r.remote_ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
