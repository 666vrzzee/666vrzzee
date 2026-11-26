import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { UserProfile, UserRole } from '../types';
import {
  apiFetch,
  getFallbackAccessToken,
  getRuntimeConfig,
  getSupabaseClient,
  setFallbackAccessToken,
} from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  supabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  registerUser: (payload: {
    email: string;
    password: string;
    full_name: string;
    nip?: string;
    jabatan?: string;
  }) => Promise<{ isFirstAdmin: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildFallbackProfileFromUser(authUser: User): UserProfile {
  const meta = (authUser.user_metadata || {}) as Record<string, unknown>;
  const rawRole = String(meta.role || '');
  const role: UserRole =
    rawRole === 'admin' || rawRole === 'guru' || rawRole === 'tenaga_kependidikan'
      ? rawRole
      : 'tenaga_kependidikan';

  return {
    id: authUser.id,
    email: authUser.email || '',
    full_name:
      String(meta.full_name || '').trim() ||
      (authUser.email ? authUser.email.split('@')[0] : 'Pengguna'),
    role,
    nip: String(meta.nip || ''),
    jabatan: String(meta.jabatan || ''),
    created_at: authUser.created_at,
    updated_at: authUser.updated_at || authUser.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);

  const fetchProfileDirectly = useCallback(async (authUser: User): Promise<UserProfile> => {
    const client = await getSupabaseClient();
    if (client) {
      try {
        const { data: dbProfile } = await client
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (dbProfile) {
          return dbProfile as UserProfile;
        }
      } catch {
        // Fallback to user metadata below
      }
    }
    return buildFallbackProfileFromUser(authUser);
  }, []);

  const syncProfileFromServer = useCallback(
    async (authUser?: User | null) => {
      try {
        const res = await apiFetch<{ profile: UserProfile }>('/api/auth/sync-profile', {
          method: 'POST',
        });
        setProfile(res.profile);
        return;
      } catch {
        // Fallback to direct Supabase profiles query via RLS if backend API is temporarily unavailable
      }

      if (authUser) {
        const directProfile = await fetchProfileDirectly(authUser);
        setProfile(directProfile);
      } else {
        setProfile(null);
      }
    },
    [fetchProfileDirectly]
  );

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    async function init() {
      try {
        const cfg = await getRuntimeConfig();
        if (!active) return;
        setSupabaseConfigured(cfg.configured || cfg.publicConfigured);

        const client = await getSupabaseClient();
        if (!client) {
          setSupabaseConfigured(false);
          setLoading(false);
          return;
        }

        const { data } = await client.auth.getSession();
        if (!active) return;

        setSession(data.session);
        setUser(data.session?.user ?? null);

        if (data.session?.user) {
          await syncProfileFromServer(data.session.user);
        } else if (getFallbackAccessToken()) {
          try {
            const res = await apiFetch<{ profile: UserProfile }>('/api/auth/me');
            if (active && res.profile) {
              setProfile(res.profile);
              setUser({ id: res.profile.id, email: res.profile.email } as User);
            }
          } catch {
            setFallbackAccessToken('');
          }
        }

        const { data: authListener } = client.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (!active) return;
            setSession(newSession);
            setUser(newSession?.user ?? null);
            if (newSession?.user) {
              await syncProfileFromServer(newSession.user);
            } else {
              setProfile(null);
            }
          }
        );
        subscription = authListener.subscription;
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [syncProfileFromServer]);

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const client = await getSupabaseClient();
    const cfg = await getRuntimeConfig();

    if (client) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (!error && data.session && data.user) {
          setSession(data.session);
          setUser(data.user);
          await syncProfileFromServer(data.user);
          return;
        }

        if (
          error &&
          !error.message.toLowerCase().includes('failed to fetch') &&
          error.name !== 'AuthRetryableFetchError'
        ) {
          throw new Error(error.message);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (!msg.toLowerCase().includes('failed to fetch')) {
          throw err;
        }
      }
    }

    // Server-side fallback when browser cannot reach Supabase Auth directly or VITE_* config differs
    try {
      const serverLogin = await apiFetch<{
        session: Session;
        user: User;
        profile: UserProfile;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      if (serverLogin.session?.access_token) {
        setFallbackAccessToken(serverLogin.session.access_token);
      }

      if (client && serverLogin.session) {
        try {
          await client.auth.setSession({
            access_token: serverLogin.session.access_token,
            refresh_token: serverLogin.session.refresh_token,
          });
        } catch {
          // Keep state synced via fallback token even if browser cannot reach Supabase directly
        }
      }

      setSession(serverLogin.session);
      setUser(serverLogin.user);
      setProfile(serverLogin.profile);
    } catch (fallbackErr) {
      const targetHost = cfg.supabaseUrl || 'Supabase Auth';
      const detail =
        fallbackErr instanceof Error ? fallbackErr.message : 'Gagal menghubungi server.';
      throw new Error(
        detail.includes('Gagal terhubung') || detail.toLowerCase().includes('failed to fetch')
          ? `Tidak dapat terhubung ke ${targetHost} maupun API server (/api/auth/login). Periksa nilai SUPABASE_URL & VITE_SUPABASE_URL di Vercel serta koneksi internet Anda.`
          : detail
      );
    }
  };

  const registerUser = async (payload: {
    email: string;
    password: string;
    full_name: string;
    nip?: string;
    jabatan?: string;
  }) => {
    const res = await apiFetch<{ user: UserProfile; isFirstAdmin: boolean }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    await signIn(payload.email, payload.password);
    return { isFirstAdmin: res.isFirstAdmin };
  };

  const signOut = async () => {
    setFallbackAccessToken('');
    const client = await getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = useCallback(async () => {
    await syncProfileFromServer(user);
  }, [syncProfileFromServer, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        supabaseConfigured,
        signIn,
        registerUser,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}
