import { useCallback, useRef, useState } from 'react'
import { parseWALogFile } from './lib/waParser'
import { exportElementToPdf } from './lib/pdfExport'
import type { WALogRow } from './types/wa'
import { TabAnalysis } from './components/TabAnalysis'
import { TabDrilldown } from './components/TabDrilldown'
import { TabUrlAnalysis } from './components/TabUrlAnalysis'
import { SQLExplorer } from './components/SQLExplorer'
import './App.css'

type TabId = 'analysis' | 'drilldown' | 'url' | 'sql'

const TABS: { id: TabId; label: string }[] = [
  { id: 'analysis', label: 'Analysis' },
  { id: 'drilldown', label: 'Request Drilldown' },
  { id: 'url', label: 'URL Analysis' },
  { id: 'sql', label: 'SQL Explorer' },
]

export default function App() {
  const [waLogs, setWaLogs] = useState<WALogRow[]>([])
  const [activeTab, setActiveTab] = useState<TabId>('analysis')
  const [dragOver, setDragOver] = useState(false)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  const clearMemory = useCallback(() => {
    setWaLogs([])
    setParseErrors([])
  }, [])

  const processFile = useCallback((file: File) => {
    setParseErrors([])
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const { rows, errors } = parseWALogFile(text)
      setWaLogs(rows)
      setParseErrors(errors)
    }
    reader.readAsText(file, 'utf-8')
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file && (file.name.endsWith('.log') || file.name.endsWith('.json') || file.name.endsWith('.jsonl'))) {
        processFile(file)
      }
    },
    [processFile]
  )

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      e.target.value = ''
    },
    [processFile]
  )

  const hasData = waLogs.length > 0

  const saveReportAsPdf = useCallback(async () => {
    if (!hasData || !reportRef.current) return
    setIsGeneratingPdf(true)
    try {
      await new Promise((r) => setTimeout(r, 800))
      const name = `WA-Log-Report-${new Date().toISOString().slice(0, 10)}.pdf`
      await exportElementToPdf(reportRef.current, name)
    } catch (e) {
      console.error('PDF export failed:', e)
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [hasData])

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>WA Log Analyzer</h1>
            <p className="subtitle">Salesforce Commerce Cloud / Demandware Web Adapter Log Analysis</p>
          </div>
          <div className="header-actions">
            {hasData && (
              <button
                type="button"
                className="btn-pdf"
                onClick={saveReportAsPdf}
                disabled={isGeneratingPdf}
                title="Save all reports and data as PDF"
              >
                {isGeneratingPdf ? '… Generating PDF' : '📄 Save report as PDF'}
              </button>
            )}
            <button type="button" className="btn-clear" onClick={clearMemory} title="Clear loaded data">
              🗑️ Clear Memory
            </button>
            <button
              type="button"
              className="btn-upload"
              onClick={() => fileInputRef.current?.click()}
              title="Upload new log file"
            >
              📤 New Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".log,.json,.jsonl"
              onChange={onFileInput}
              style={{ display: 'none' }}
            />
          </div>
        </div>
        <nav className="tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`tab ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {!hasData && (
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="icon">📁</div>
            <strong>Drop a WA log file here or click to browse</strong>
            <div className="hint">Supports pipe-delimited .log (Demandware WA format)</div>
          </div>
        )}

        {parseErrors.length > 0 && (
          <div className="errors">
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {parseErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {hasData && (
          <>
            {activeTab === 'analysis' && <TabAnalysis rows={waLogs} />}
            {activeTab === 'drilldown' && <TabDrilldown rows={waLogs} />}
            {activeTab === 'url' && <TabUrlAnalysis rows={waLogs} />}
            {activeTab === 'sql' && <SQLExplorer rows={waLogs} />}
          </>
        )}
      </main>

      <footer className="footer">
        Data is temporary and will be deleted after 2 hours or when you close this page. Use &quot;Save report as PDF&quot; to keep a copy.
      </footer>

      {isGeneratingPdf && (
        <div className="pdf-overlay" aria-busy="true">
          <div className="pdf-message">Generating PDF…</div>
        </div>
      )}

      {hasData && (
        <div
          ref={reportRef}
          className="report-for-pdf"
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: isGeneratingPdf ? 9998 : -1,
            visibility: isGeneratingPdf ? 'visible' : 'hidden',
            pointerEvents: 'none',
          }}
        >
          <div className="report-title">WA Log Analyzer — Report</div>
          <div className="report-date">{new Date().toLocaleString()}</div>
          <div className="report-section">
            <h2>Analysis</h2>
            <TabAnalysis rows={waLogs} />
          </div>
          <div className="report-section">
            <h2>Request Drilldown</h2>
            <TabDrilldown rows={waLogs} />
          </div>
          <div className="report-section">
            <h2>URL Analysis</h2>
            <TabUrlAnalysis rows={waLogs} />
          </div>
          <div className="report-section">
            <h2>SQL Explorer</h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Run queries in the app. This report contains Analysis, Drilldown, and URL data.</p>
          </div>
        </div>
      )}
    </div>
  )
}
