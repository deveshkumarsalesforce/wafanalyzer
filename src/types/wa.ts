/**
 * Single row from WA (Web Adapter) pipe-delimited log — maps to wa_logs for SQL Explorer.
 */
export interface WALogRow {
  start_time_ms: number;
  remote_ip: string;
  remote_user: string;
  server_name: string;
  server_port: number;
  runtime_ms: number;
  path_query: string;
  user_agent: string;
  cookie: string;
  referrer: string;
  session_id: string;
  request_id: string;
  response_source: string;
  status_code: number;
  recv_duration_ms: number;
  queue_wait_ms: number;
  method: string;
}

/** Request ID pattern: main requests end with -0-00 (level 0). */
export function isMainRequest(requestId: string): boolean {
  return /-0-00\s*$/.test(requestId.trim());
}

/** Cache: "pc" = page cache (HIT), server:port = MISS. */
export function isCacheHit(responseSource: string): boolean {
  return responseSource?.trim().toLowerCase() === 'pc';
}

export const WA_LOGS_SCHEMA_COLUMNS = [
  'start_time_ms',
  'remote_ip',
  'remote_user',
  'server_name',
  'server_port',
  'runtime_ms',
  'path_query',
  'user_agent',
  'cookie',
  'referrer',
  'session_id',
  'request_id',
  'response_source',
  'status_code',
  'recv_duration_ms',
  'queue_wait_ms',
  'method',
] as const;
