import type { AwsWafLogEntry, NormalizedLogEntry, WafAnalysisResult } from '../types/waf';

const ACTIONS = ['ALLOW', 'BLOCK', 'COUNT', 'CAPTCHA', 'CHALLENGE'] as const;

function normalizeAwsEntry(raw: AwsWafLogEntry, index: number): NormalizedLogEntry {
  const action = raw.action && ACTIONS.includes(raw.action as (typeof ACTIONS)[number])
    ? (raw.action as NormalizedLogEntry['action'])
    : 'UNKNOWN';
  const ts = raw.timestamp ?? Date.now();
  return {
    id: `entry-${index}-${ts}`,
    timestamp: typeof ts === 'number' ? ts : Date.parse(String(ts)),
    action,
    clientIp: raw.httpRequest?.clientIp ?? '0.0.0.0',
    country: raw.httpRequest?.country,
    method: raw.httpRequest?.httpMethod,
    uri: raw.httpRequest?.uri,
    ruleId: raw.terminatingRuleId,
    ruleType: raw.terminatingRuleType,
    raw,
  };
}

const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function parsePipeDelimitedLine(line: string, index: number): NormalizedLogEntry | null {
  const parts = line.split('|');
  if (parts.length < 14) return null;
  const tsRaw = parts[0]?.trim();
  const ts = tsRaw ? parseInt(tsRaw, 10) : NaN;
  if (Number.isNaN(ts) || ts <= 0) return null;

  const uri = (parts[6] ?? '').trim().startsWith('/') ? (parts[6] ?? '').trim() : undefined;
  const method = parts[19]?.trim();
  const status = parts[13]?.trim();
  let clientIp = '0.0.0.0';
  if (parts[1] && IP_REGEX.test(parts[1])) clientIp = parts[1];
  else if (parts[24] && IP_REGEX.test(parts[24])) clientIp = parts[24];
  else if (parts[22] && IP_REGEX.test(parts[22])) clientIp = parts[22];

  const action: NormalizedLogEntry['action'] =
    status === '200' ? 'ALLOW' : status && status.startsWith('4') ? 'BLOCK' : 'COUNT';

  return {
    id: `pipe-${index}-${ts}`,
    timestamp: ts,
    action,
    clientIp,
    method: HTTP_METHODS.includes(method ?? '') ? method : undefined,
    uri: uri || undefined,
    raw: { line: line.slice(0, 80), status, parts: parts.length },
  };
}

function tryParseJsonLine(line: string): AwsWafLogEntry | null {
  line = line.trim();
  if (!line) return null;
  try {
    const parsed = JSON.parse(line) as AwsWafLogEntry;
    if (parsed && (parsed.httpRequest != null || parsed.action != null || parsed.timestamp != null)) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function isJsonFormat(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return true;
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  try {
    if (firstLine.startsWith('{')) {
      JSON.parse(firstLine);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function parseWafFile(content: string): { entries: NormalizedLogEntry[]; errors: string[] } {
  const errors: string[] = [];
  const entries: NormalizedLogEntry[] = [];
  const trimmed = content.trim();

  if (!trimmed) {
    errors.push('File is empty');
    return { entries, errors };
  }

  const lines = trimmed.split(/\r?\n/);

  if (isJsonFormat(trimmed)) {
    let parsed: AwsWafLogEntry[] = [];
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed) as unknown[];
        if (Array.isArray(arr)) {
          parsed = arr.filter((x): x is AwsWafLogEntry => x != null && typeof x === 'object');
        }
      } catch (e) {
        errors.push('Invalid JSON array: ' + (e instanceof Error ? e.message : String(e)));
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        const entry = tryParseJsonLine(lines[i]);
        if (entry) parsed.push(entry);
      }
    }
    parsed.forEach((raw, i) => entries.push(normalizeAwsEntry(raw, i)));
  } else {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? '';
      if (!line || line.startsWith('Opening') || !/^\d+\|/.test(line)) continue;
      const entry = parsePipeDelimitedLine(line, i);
      if (entry) entries.push(entry);
    }
  }

  if (entries.length === 0 && errors.length === 0) {
    errors.push('No valid WAF log entries found. Expect JSON, JSONL, or pipe-delimited (.log) format.');
  }

  return { entries, errors };
}

function aggregate<T>(items: T[], keyFn: (item: T) => string): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) || '(empty)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function analyze(entries: NormalizedLogEntry[]): WafAnalysisResult {
  const byAction: Record<string, number> = {};
  for (const e of entries) {
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
  }

  const topClientIps = aggregate(entries, (e) => e.clientIp)
    .slice(0, 10)
    .map(({ key: ip, count }) => ({ ip, count }));

  const topUris = aggregate(entries, (e) => e.uri ?? '')
    .filter((x) => x.key !== '(empty)')
    .slice(0, 10)
    .map(({ key: uri, count }) => ({ uri, count }));

  const topRules = aggregate(entries, (e) => e.ruleId ?? '')
    .filter((x) => x.key !== '(empty)')
    .slice(0, 10)
    .map(({ key: ruleId, count }) => ({ ruleId, count }));

  const byCountry = aggregate(entries, (e) => e.country ?? 'Unknown').map(({ key: country, count }) => ({ country, count }));

  const hourMap = new Map<string, { count: number; blocked: number }>();
  for (const e of entries) {
    const d = new Date(e.timestamp);
    const hour = d.toISOString().slice(0, 13) + 'Z';
    const cur = hourMap.get(hour) ?? { count: 0, blocked: 0 };
    cur.count += 1;
    if (e.action === 'BLOCK') cur.blocked += 1;
    hourMap.set(hour, cur);
  }
  const byHour = Array.from(hourMap.entries())
    .map(([hour, v]) => ({ hour, count: v.count, blocked: v.blocked }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  return {
    entries,
    total: entries.length,
    byAction,
    topClientIps,
    topUris,
    topRules,
    byCountry,
    byHour,
    errors: [],
  };
}
