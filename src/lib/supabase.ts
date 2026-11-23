import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface RuntimeConfig {
  configured: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let cachedConfig: RuntimeConfig | null = null;
let cachedClient: SupabaseClient | null = null;

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) return cachedConfig;

  const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const serverConfig = (await res.json()) as RuntimeConfig;
      cachedConfig = {
        configured: serverConfig.configured || Boolean(envUrl && envKey),
        supabaseUrl: serverConfig.supabaseUrl || envUrl || '',
        supabaseAnonKey: serverConfig.supabaseAnonKey || envKey || '',
      };
      return cachedConfig;
    }
  } catch {
    // Fallback to Vite env vars
  }

  cachedConfig = {
    configured: Boolean(envUrl && envKey),
    supabaseUrl: envUrl || '',
    supabaseAnonKey: envKey || '',
  };
  return cachedConfig;
}

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;

  const cfg = await getRuntimeConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    return null;
  }

  cachedClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const client = await getSupabaseClient();
  let token = '';

  if (client) {
    const { data } = await client.auth.getSession();
    token = data.session?.access_token || '';
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { error: text || 'Respons server tidak valid.' };
  }

  if (!res.ok) {
    throw new Error(String(json.error || `Permintaan gagal (${res.status})`));
  }

  return json as T;
}
