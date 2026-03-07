/**
 * Streaming WAF log parser for large files (GBs).
 * Reads file in chunks, parses line-by-line, and updates aggregates only (no full entry list in memory).
 */

import type { AwsWafLogEntry, NormalizedLogEntry, WafAnalysisResult } from '../types/waf';

const ACTIONS = ['ALLOW', 'BLOCK', 'COUNT', 'CAPTCHA', 'CHALLENGE'] as const;
const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const YIELD_EVERY_LINES = 25000; // yield to UI and report progress
const TOP_N = 15;

type Format = 'json' | 'pipe';

interface StreamAggregates {
  total: number;
  byAction: Record<string, number>;
  byClientIp: Map<string, number>;
  byUri: Map<string, number>;
  byRuleId: Map<string, number>;
  byCountry: Map<string, number>;
  byHour: Map<string, { count: number; blocked: number }>;
}

function createAggregates(): StreamAggregates {
  return {
    total: 0,
    byAction: {},
    byClientIp: new Map(),
    byUri: new Map(),
    byRuleId: new Map(),
    byCountry: new Map(),
    byHour: new Map(),
  };
}

function updateAggregates(entry: NormalizedLogEntry, agg: StreamAggregates): void {
  agg.total += 1;
  agg.byAction[entry.action] = (agg.byAction[entry.action] ?? 0) + 1;

  const ip = entry.clientIp || '(empty)';
  agg.byClientIp.set(ip, (agg.byClientIp.get(ip) ?? 0) + 1);

  const uri = entry.uri || '';
  if (uri) agg.byUri.set(uri, (agg.byUri.get(uri) ?? 0) + 1);

  const ruleId = entry.ruleId || '';
  if (ruleId) agg.byRuleId.set(ruleId, (agg.byRuleId.get(ruleId) ?? 0) + 1);

  const country = entry.country ?? 'Unknown';
  agg.byCountry.set(country, (agg.byCountry.get(country) ?? 0) + 1);

  const hour = new Date(entry.timestamp).toISOString().slice(0, 13) + 'Z';
  const cur = agg.byHour.get(hour) ?? { count: 0, blocked: 0 };
  cur.count += 1;
  if (entry.action === 'BLOCK') cur.blocked += 1;
  agg.byHour.set(hour, cur);
}

function parseJsonLine(line: string, lineIndex: number): NormalizedLogEntry | null {
  const t = line.trim();
  if (!t) return null;
  try {
    const raw = JSON.parse(t) as AwsWafLogEntry;
    if (!raw || (raw.httpRequest == null && raw.action == null && raw.timestamp == null)) return null;
    const action = raw.action && ACTIONS.includes(raw.action as (typeof ACTIONS)[number])
      ? (raw.action as NormalizedLogEntry['action'])
      : 'UNKNOWN';
    const ts = raw.timestamp ?? Date.now();
    return {
      id: `s-${lineIndex}-${ts}`,
      timestamp: typeof ts === 'number' ? ts : Date.parse(String(ts)),
      action,
      clientIp: raw.httpRequest?.clientIp ?? '0.0.0.0',
      country: raw.httpRequest?.country,
      method: raw.httpRequest?.httpMethod,
      uri: raw.httpRequest?.uri,
      ruleId: raw.terminatingRuleId,
      ruleType: raw.terminatingRuleType,
    };
  } catch {
    return null;
  }
}

function parsePipeLine(line: string, lineIndex: number): NormalizedLogEntry | null {
  const parts = line.split('|');
  if (parts.length < 14) return null;
  const tsRaw = parts[0]?.trim();
  const ts = tsRaw ? parseInt(tsRaw, 10) : NaN;
  if (Number.isNaN(ts) || ts <= 0) return null;
  if (line.startsWith('Opening') || !/^\d+\|/.test(line)) return null;

  const uri = (parts[6] ?? '').trim().startsWith('/') ? (parts[6] ?? '').trim() : undefined;
  const method = parts[19]?.trim();
  const status = parts[13]?.trim();
  let clientIp = '0.0.0.0';
  if (parts[1] && IP_REGEX.test(parts[1])) clientIp = parts[1];
  else if (parts[24] && IP_REGEX.test(parts[24])) clientIp = parts[24];
  else if (parts[22] && IP_REGEX.test(parts[22])) clientIp = parts[22];

  const action: NormalizedLogEntry['action'] =
    status === '200' ? 'ALLOW' : status?.startsWith('4') ? 'BLOCK' : 'COUNT';

  return {
    id: `s-${lineIndex}-${ts}`,
    timestamp: ts,
    action,
    clientIp,
    method: HTTP_METHODS.includes(method ?? '') ? method : undefined,
    uri: uri || undefined,
  };
}

function aggregatesToResult(agg: StreamAggregates, errors: string[]): WafAnalysisResult {
  const top = (map: Map<string, number>, n: number) =>
    Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);

  return {
    entries: [],
    total: agg.total,
    byAction: { ...agg.byAction },
    topClientIps: top(agg.byClientIp, 10).map(({ key: ip, count }) => ({ ip, count })),
    topUris: top(agg.byUri, 10).map(({ key: uri, count }) => ({ uri, count })),
    topRules: top(agg.byRuleId, 10).map(({ key: ruleId, count }) => ({ ruleId, count })),
    byCountry: top(agg.byCountry, TOP_N).map(({ key: country, count }) => ({ country, count })),
    byHour: Array.from(agg.byHour.entries())
      .map(([hour, v]) => ({ hour, count: v.count, blocked: v.blocked }))
      .sort((a, b) => a.hour.localeCompare(b.hour)),
    errors,
  };
}

function detectFormatFromLine(line: string): Format | null {
  const t = line.trim();
  if (!t) return null;
  if (t.startsWith('{')) {
    try {
      const o = JSON.parse(t) as unknown;
      if (o && typeof o === 'object' && ('httpRequest' in o || 'action' in o || 'timestamp' in o)) return 'json';
    } catch {
      // not json
    }
  }
  if (/^\d+\|/.test(t) && t.includes('|')) return 'pipe';
  return null;
}

export interface StreamProgress {
  bytesRead: number;
  fileSize: number;
  linesParsed: number;
  phase: 'reading' | 'parsing' | 'done';
}

/**
 * Stream a WAF log file and build aggregates only. Suitable for GB-sized files.
 */
export async function streamWafFile(
  file: File,
  onProgress: (p: StreamProgress) => void,
  signal?: AbortSignal | null
): Promise<{ result: WafAnalysisResult; errors: string[] }> {
  const errors: string[] = [];
  const agg = createAggregates();
  const fileSize = file.size;
  let bytesRead = 0;
  let linesParsed = 0;
  let format: Format | null = null;
  let buffer = '';
  let lineIndex = 0;

  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (signal?.aborted) {
        errors.push('Analysis cancelled.');
        break;
      }
      bytesRead += value.length;
      buffer += decoder.decode(value, { stream: true });
      onProgress({ bytesRead, fileSize, linesParsed, phase: 'reading' });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (format == null) {
          format = detectFormatFromLine(line);
          if (format == null) continue;
        }

        const entry =
          format === 'json'
            ? parseJsonLine(line, lineIndex)
            : parsePipeLine(line, lineIndex);

        if (entry) {
          updateAggregates(entry, agg);
          linesParsed += 1;
        }
        lineIndex += 1;

        if (linesParsed > 0 && linesParsed % YIELD_EVERY_LINES === 0) {
          onProgress({ bytesRead, fileSize, linesParsed, phase: 'parsing' });
          await new Promise<void>((r) => setTimeout(r, 0));
          if (signal?.aborted) break;
        }
      }
    }

    if (buffer.trim() && format != null) {
      const entry = format === 'json' ? parseJsonLine(buffer, lineIndex) : parsePipeLine(buffer, lineIndex);
      if (entry) {
        updateAggregates(entry, agg);
        linesParsed += 1;
      }
    }

    if (agg.total === 0 && errors.length === 0) {
      errors.push('No valid WAF log entries found. Expect JSON, JSONL, or pipe-delimited format.');
    }

    onProgress({ bytesRead, fileSize, linesParsed, phase: 'done' });
    const result = aggregatesToResult(agg, errors);
    return { result, errors };
  } finally {
    reader.releaseLock();
  }
}

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KB';
  return n + ' B';
}

export function formatProgress(p: StreamProgress): string {
  const size = formatBytes(p.fileSize);
  const read = formatBytes(p.bytesRead);
  if (p.phase === 'done') return `Done — ${p.linesParsed.toLocaleString()} lines from ${size}`;
  return `${p.phase === 'parsing' ? 'Parsing' : 'Reading'} ${read} / ${size} — ${p.linesParsed.toLocaleString()} lines`;
}
