import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { apiFetch, getRuntimeConfig, getSupabaseClient } from '../lib/supabase';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);

  const syncProfileFromServer = useCallback(async (throwOnError = false) => {
    try {
      const res = await apiFetch<{ profile: UserProfile }>('/api/auth/sync-profile', {
        method: 'POST',
      });
      setProfile(res.profile);
    } catch (err) {
      setProfile(null);
      if (throwOnError) {
        throw err;
      }
    }
  }, []);

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
          await syncProfileFromServer(false);
        }

        const { data: authListener } = client.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (!active) return;
            setSession(newSession);
            setUser(newSession?.user ?? null);
            if (newSession?.user) {
              await syncProfileFromServer(false);
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
    const client = await getSupabaseClient();
    if (!client) {
      throw new Error(
        'Konfigurasi Supabase belum valid atau belum diisi. Pastikan SUPABASE_URL (diawali https://), SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY sudah diatur.'
      );
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
      await syncProfileFromServer(true);
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
    const client = await getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const refreshProfile = useCallback(async () => {
    await syncProfileFromServer(false);
  }, [syncProfileFromServer]);

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
