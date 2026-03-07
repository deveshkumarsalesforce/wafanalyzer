/**
 * Minimal in-memory SQL runner for wa_logs table.
 * Supports: SELECT * FROM wa_logs [ORDER BY column [ASC|DESC]] [LIMIT n]
 */

import type { WALogRow } from '../types/wa';
import { WA_LOGS_SCHEMA_COLUMNS } from '../types/wa';

const LIMIT_REGEX = /LIMIT\s+(\d+)/i;
const ORDER_REGEX = /ORDER\s+BY\s+(\w+)(\s+(ASC|DESC))?/i;

export function runQuery(query: string, rows: WALogRow[]): { data: WALogRow[]; error?: string } {
  const q = query.trim();
  if (!q.toUpperCase().includes('SELECT') || !q.toUpperCase().includes('WA_LOGS')) {
    return { data: [], error: 'Only SELECT from wa_logs is supported. Example: SELECT * FROM wa_logs LIMIT 100' };
  }

  let result: WALogRow[] = [...rows];

  const orderMatch = q.match(ORDER_REGEX);
  if (orderMatch) {
    const col = orderMatch[1];
    const dir = (orderMatch[3] ?? 'ASC').toUpperCase();
    const key = WA_LOGS_SCHEMA_COLUMNS.includes(col as (typeof WA_LOGS_SCHEMA_COLUMNS)[number])
      ? col
      : null;
    if (key) {
      result.sort((a, b) => {
        const va = (a as unknown as Record<string, unknown>)[key];
        const vb = (b as unknown as Record<string, unknown>)[key];
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return dir === 'DESC' ? -cmp : cmp;
      });
    }
  }

  const limitMatch = q.match(LIMIT_REGEX);
  if (limitMatch) {
    const n = parseInt(limitMatch[1], 10);
    if (!Number.isNaN(n) && n > 0) result = result.slice(0, n);
  }

  return { data: result };
}
