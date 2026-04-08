const SUPABASE_URL = 'https://lyuiazskqubmlzwuokzm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5dWlhenNrcXVibWx6d3Vva3ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjIyNzQsImV4cCI6MjA5MDA5ODI3NH0.R-8NDZHFpmfqt0Lw0QhdZtNvaXY28NzLKFSEyFpb6g4';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function supabaseInsert<T = any>(table: string, data: Record<string, any>): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert to ${table} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T[]>;
}

export async function supabaseSelect<T = any>(
  table: string,
  filters?: Record<string, string>,
  options?: { select?: string; order?: string; limit?: number }
): Promise<T[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${options?.select || '*'}`;
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      url += `&${key}=eq.${value}`;
    });
  }
  if (options?.order) url += `&order=${options.order}`;
  if (options?.limit) url += `&limit=${options.limit}`;

  const res = await fetch(url, { headers: { ...headers, 'Prefer': '' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase select from ${table} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T[]>;
}

export async function supabaseUpdate(
  table: string,
  filters: Record<string, string>,
  data: Record<string, any>
): Promise<void> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?`;
  Object.entries(filters).forEach(([key, value]) => {
    url += `${key}=eq.${value}&`;
  });

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update on ${table} failed: ${res.status} ${text}`);
  }
}
