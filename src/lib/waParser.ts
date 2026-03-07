/**
 * Parser for Salesforce Commerce Cloud / Demandware WA (Web Adapter) pipe-delimited logs.
 * Produces WALogRow[] for dashboard and SQL Explorer.
 */

import type { WALogRow } from '../types/wa';

const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function num(s: string | undefined): number {
  if (s == null || s === '') return 0;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? 0 : n;
}

function str(s: string | undefined): string {
  return s?.trim() ?? '';
}

/**
 * Parse one pipe-delimited line into WALogRow or null.
 * Long format: start_time|remote_ip||server_name|port|runtime_ms|path|user_agent|cookie|referrer|session_id|request_id|response_source|status|...
 * Short format: start_time|||||runtime_ms|path||||session_id|request_id|response_source|status|...
 */
export function parseWALogLine(line: string): WALogRow | null {
  const parts = line.split('|');
  if (parts.length < 14) return null;
  const t0 = parts[0]?.trim();
  const startTime = t0 ? parseInt(t0, 10) : NaN;
  if (Number.isNaN(startTime) || startTime <= 0) return null;
  if (line.startsWith('Opening') || !/^\d+\|/.test(line)) return null;

  const pathQuery = (parts[6] ?? '').trim();
  if (!pathQuery.startsWith('/')) return null;

  const isLongFormat = IP_REGEX.test(parts[1] ?? '');
  const remoteIp = isLongFormat ? str(parts[1]) : (str(parts[24]) || str(parts[22]) || '0.0.0.0');
  const runtimeMs = num(parts[5]) || num(parts[23]) || 0;

  return {
    start_time_ms: startTime,
    remote_ip: remoteIp,
    remote_user: str(parts[2]),
    server_name: str(parts[3]),
    server_port: num(parts[4]),
    runtime_ms: runtimeMs,
    path_query: pathQuery,
    user_agent: isLongFormat ? str(parts[7]) : '',
    cookie: isLongFormat ? str(parts[8]) : '',
    referrer: isLongFormat ? str(parts[9]) : '',
    session_id: str(parts[10]),
    request_id: str(parts[11]),
    response_source: str(parts[12]),
  status_code: num(parts[13]),
  recv_duration_ms: num(parts[23]) || 0,
  queue_wait_ms: num(parts[14]) || num(parts[17]) || 0,
  method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(str(parts[19])) ? str(parts[19]) : 'GET',
  };
}

export function parseWALogFile(content: string): { rows: WALogRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: WALogRow[] = [];
  const lines = content.trim().split(/\r?\n/);

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('Opening')) continue;
    const row = parseWALogLine(line);
    if (row) rows.push(row);
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('No valid WA log entries found. Expect pipe-delimited format.');
  }
  return { rows, errors };
}
