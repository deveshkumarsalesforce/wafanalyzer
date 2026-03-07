import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WALogRow } from '../types/wa'
import { topSlowestPages } from '../lib/waStats'

export function TabUrlAnalysis({ rows }: { rows: WALogRow[] }) {
  const byPathCount = new Map<string, number>()
  for (const r of rows) {
    const p = r.path_query || '(empty)'
    byPathCount.set(p, (byPathCount.get(p) ?? 0) + 1)
  }
  const topByCount = Array.from(byPathCount.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
  const topByRuntime = topSlowestPages(rows, 30)

  return (
    <>
      <h2 className="section-title">URL Analysis</h2>
      <p className="section-subtitle">Breakdown by path: request count and average runtime.</p>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Top URLs by Request Count</h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={topByCount} margin={{ left: 8, right: 8, bottom: 100 }}>
              <XAxis dataKey="path" angle={-35} textAnchor="end" tick={{ fontSize: 9 }} tickFormatter={(v) => (v.length > 40 ? v.slice(0, 40) + '…' : v)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => v} labelFormatter={(l) => l} />
              <Bar dataKey="count" fill="#2563eb" name="Requests" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Top URLs by Avg Runtime (ms)</h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={topByRuntime} margin={{ left: 8, right: 8, bottom: 100 }}>
              <XAxis dataKey="path" angle={-35} textAnchor="end" tick={{ fontSize: 9 }} tickFormatter={(v) => (v.length > 40 ? v.slice(0, 40) + '…' : v)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [v?.toFixed(0), 'Avg ms']} labelFormatter={(l) => l} />
              <Bar dataKey="avgRuntime" fill="#7c3aed" name="Avg Runtime" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  )
}
