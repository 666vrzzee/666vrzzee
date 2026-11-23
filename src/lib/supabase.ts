import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface RuntimeConfig {
  configured: boolean;
  publicConfigured: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let cachedConfig: RuntimeConfig | null = null;
let cachedClient: SupabaseClient | null = null;

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^["']+|["']+$/g, '').trim();
}

export function normalizeSupabaseUrl(raw: string | undefined): string {
  let value = cleanEnvValue(raw);
  if (!value) return '';
  if (
    value.includes('your-project-id') ||
    value.startsWith('MY_') ||
    value.includes('your-supabase')
  ) {
    return '';
  }
  if (!/^https?:\/\//i.test(value) && value.includes('.supabase.')) {
    value = `https://${value}`;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

function isRealAnonKey(raw: string | undefined): string {
  const value = cleanEnvValue(raw);
  if (!value || value.startsWith('your-') || value.startsWith('MY_')) {
    return '';
  }
  return value;
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  if (cachedConfig) return cachedConfig;

  const envUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const envKey = isRealAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

  try {
    const res = await fetch('/api/config');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const serverConfig = (await res.json()) as Partial<RuntimeConfig>;
      const resolvedUrl = normalizeSupabaseUrl(serverConfig.supabaseUrl) || envUrl;
      const resolvedKey = isRealAnonKey(serverConfig.supabaseAnonKey) || envKey;
      const publicReady = Boolean(resolvedUrl && resolvedKey);

      cachedConfig = {
        configured: Boolean(serverConfig.configured) && publicReady,
        publicConfigured: publicReady,
        supabaseUrl: resolvedUrl,
        supabaseAnonKey: resolvedKey,
      };
      return cachedConfig;
    }
  } catch {
    // Fallback to Vite build-time env vars
  }

  const publicReady = Boolean(envUrl && envKey);
  cachedConfig = {
    configured: publicReady,
    publicConfigured: publicReady,
    supabaseUrl: envUrl,
    supabaseAnonKey: envKey,
  };
  return cachedConfig;
}

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (cachedClient) return cachedClient;

  const cfg = await getRuntimeConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    return null;
  }

  try {
    cachedClient = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return cachedClient;
  } catch {
    return null;
  }
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
    json = {
      error: text.startsWith('<')
        ? 'Endpoint API /api/* belum merespons JSON. Pastikan server atau Vercel API route aktif.'
        : text || 'Respons server tidak valid.',
    };
  }

  if (!res.ok) {
    throw new Error(String(json.error || `Permintaan gagal (${res.status})`));
  }

  return json as T;
}
