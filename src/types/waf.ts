/**
 * AWS WAF log entry (single JSON object per line or array)
 * @see https://docs.aws.amazon.com/waf/latest/developerguide/logging-fields.html
 */
export interface AwsWafLogEntry {
  timestamp?: number;
  formatVersion?: number;
  webaclId?: string;
  action?: 'ALLOW' | 'BLOCK' | 'COUNT' | 'CAPTCHA' | 'CHALLENGE';
  httpRequest?: {
    clientIp?: string;
    country?: string;
    httpMethod?: string;
    uri?: string;
    args?: string;
    headers?: Array<{ name?: string; value?: string }>;
    requestId?: string;
  };
  terminatingRuleId?: string;
  terminatingRuleType?: string;
  ruleGroupList?: Array<{
    ruleGroupId?: string;
    terminatingRule?: { ruleId?: string; action?: string };
    nonTerminatingMatchingRules?: Array<{ ruleId?: string; action?: string }>;
  }>;
  nonTerminatingMatchingRules?: Array<{ ruleId?: string; ruleType?: string; action?: string }>;
  httpSourceName?: string;
  httpSourceId?: string;
}

/** Normalized log entry for analysis (works with any supported format) */
export interface NormalizedLogEntry {
  id: string;
  timestamp: number;
  action: 'ALLOW' | 'BLOCK' | 'COUNT' | 'CAPTCHA' | 'CHALLENGE' | 'UNKNOWN';
  clientIp: string;
  country?: string;
  method?: string;
  uri?: string;
  ruleId?: string;
  ruleType?: string;
  raw?: unknown;
}

/** Aggregated analysis result */
export interface WafAnalysisResult {
  entries: NormalizedLogEntry[];
  total: number;
  byAction: Record<string, number>;
  topClientIps: Array<{ ip: string; count: number }>;
  topUris: Array<{ uri: string; count: number }>;
  topRules: Array<{ ruleId: string; count: number }>;
  byCountry: Array<{ country: string; count: number }>;
  byHour: Array<{ hour: string; count: number; blocked: number }>;
  errors: string[];
}
