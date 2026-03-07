import { useCallback, useRef, useState } from 'react'
import { parseWALogFile } from './lib/waParser'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>WA Log Analyzer</h1>
            <p className="subtitle">Salesforce Commerce Cloud / Demandware Web Adapter Log Analysis</p>
          </div>
          <div className="header-actions">
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
        Data is temporary and will be deleted after 2 hours or when you close this page. Download any results you need before closing.
      </footer>
    </div>
  )
}
