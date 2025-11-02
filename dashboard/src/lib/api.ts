/**
 * API Client for Analytics Engine queries
 */

const API_BASE = import.meta.env.DEV ? 'http://localhost:8787' : '';
const API_KEY = import.meta.env.VITE_API_KEY || '';

export interface QueryResult {
  success: boolean;
  data: {
    data: Array<Record<string, string | number>>;
    rows: number;
  };
}

export async function query(sql: string): Promise<QueryResult> {
  const response = await fetch(`${API_BASE}/api/analytics/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function loadDecisions(hours: number = 24) {
  const result = await query(`
    SELECT
      blob1 as decision,
      SUM(_sample_interval) as count
    FROM ANALYTICS
    WHERE timestamp >= NOW() - INTERVAL '${hours}' HOUR
    GROUP BY decision
    ORDER BY count DESC
  `);

  return result.data.data.map((row) => ({
    decision: String(row.decision),
    count: Number(row.count),
  }));
}
