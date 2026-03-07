/**
 * Compute dashboard stats from WALogRow[].
 */

import type { WALogRow } from '../types/wa';
import { isCacheHit, isMainRequest } from '../types/wa';

export function uniqueSessions(rows: WALogRow[]): number {
  return new Set(rows.map((r) => r.session_id).filter(Boolean)).size;
}

export function uniqueIps(rows: WALogRow[]): number {
  return new Set(rows.map((r) => r.remote_ip).filter(Boolean)).size;
}

export function cacheHitRate(rows: WALogRow[]): number {
  if (rows.length === 0) return 0;
  const hits = rows.filter((r) => isCacheHit(r.response_source)).length;
  return Math.round((100 * hits) / rows.length);
}

export function errorRate(rows: WALogRow[]): number {
  if (rows.length === 0) return 0;
  const errors = rows.filter((r) => r.status_code >= 400).length;
  return Math.round((10000 * errors) / rows.length) / 100;
}

export function runtimePercentiles(rows: WALogRow[]): { p50: number; p75: number; p95: number; p99: number; max: number } {
  const runtimes = rows.map((r) => r.runtime_ms).filter((n) => n >= 0).sort((a, b) => a - b);
  if (runtimes.length === 0) return { p50: 0, p75: 0, p95: 0, p99: 0, max: 0 };
  const p = (q: number) => {
    const i = Math.ceil((q / 100) * runtimes.length) - 1;
    return runtimes[Math.max(0, i)] ?? 0;
  };
  return {
    p50: p(50),
    p75: p(75),
    p95: p(95),
    p99: p(99),
    max: runtimes[runtimes.length - 1] ?? 0,
  };
}

export function topSlowestPages(rows: WALogRow[], n: number): Array<{ path: string; avgRuntime: number; count: number }> {
  const byPath = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const path = r.path_query || '(empty)';
    const cur = byPath.get(path) ?? { sum: 0, count: 0 };
    cur.sum += r.runtime_ms;
    cur.count += 1;
    byPath.set(path, cur);
  }
  return Array.from(byPath.entries())
    .map(([path, v]) => ({ path, avgRuntime: v.count ? v.sum / v.count : 0, count: v.count }))
    .sort((a, b) => b.avgRuntime - a.avgRuntime)
    .slice(0, n);
}

export function trafficByHour(rows: WALogRow[]): Array<{ hour: number; requests: number; avgRuntime: number }> {
  const byHour = new Map<number, { count: number; sum: number }>();
  for (const r of rows) {
    const date = new Date(r.start_time_ms);
    const hour = date.getUTCHours();
    const cur = byHour.get(hour) ?? { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += r.runtime_ms;
    byHour.set(hour, cur);
  }
  return Array.from(byHour.entries())
    .map(([hour, v]) => ({ hour, requests: v.count, avgRuntime: v.count ? v.sum / v.count : 0 }))
    .sort((a, b) => a.hour - b.hour);
}

export function statusCodeDistribution(rows: WALogRow[]): Array<{ status: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const s = String(r.status_code);
    map.set(s, (map.get(s) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([status, count]) => ({ status, count }));
}

export function cachePerformance(rows: WALogRow[]): { hits: number; misses: number } {
  let hits = 0;
  let misses = 0;
  for (const r of rows) {
    if (isCacheHit(r.response_source)) hits += 1;
    else misses += 1;
  }
  return { hits, misses };
}

export function topSlowestRequests(rows: WALogRow[], n: number): WALogRow[] {
  return [...rows].sort((a, b) => b.runtime_ms - a.runtime_ms).slice(0, n);
}

/** Main requests (level 0) with include count. */
export interface MainRequestRow {
  request_id: string;
  path_query: string;
  runtime_ms: number;
  status_code: number;
  method: string;
  includes: number;
  cacheHit: boolean;
  remote_ip: string;
  row: WALogRow;
}

function requestIdBase(requestId: string): string {
  return requestId.replace(/-\d+-\d+\s*$/, '');
}

export function getMainRequests(rows: WALogRow[]): MainRequestRow[] {
  const mains = rows.filter((r) => isMainRequest(r.request_id));
  const baseToIncludes = new Map<string, number>();
  for (const r of rows) {
    if (isMainRequest(r.request_id)) continue;
    const base = requestIdBase(r.request_id);
    baseToIncludes.set(base, (baseToIncludes.get(base) ?? 0) + 1);
  }
  return mains.map((row) => ({
    request_id: row.request_id,
    path_query: row.path_query,
    runtime_ms: row.runtime_ms,
    status_code: row.status_code,
    method: row.method || 'GET',
    includes: baseToIncludes.get(requestIdBase(row.request_id)) ?? 0,
    cacheHit: isCacheHit(row.response_source),
    remote_ip: row.remote_ip,
    row,
  }));
}

export function getIncludesForMain(rows: WALogRow[], mainRequestId: string): WALogRow[] {
  const base = requestIdBase(mainRequestId);
  return rows.filter((r) => !isMainRequest(r.request_id) && requestIdBase(r.request_id) === base);
}
