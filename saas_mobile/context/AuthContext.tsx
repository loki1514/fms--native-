import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Session } from '@supabase/supabase-js';

import { createClient } from '@/utils/supabase/client';
import { UserMembership, PropertyInfo } from '@/types/membership';
import { getValidToken, clearToken } from '@/services/cassandra/cassandraAuthService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extended user type that includes common metadata fields. */
export type AuthUser = User & {
  name?: string;
  avatar?: string;
  full_name?: string;
};

export interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  membership: UserMembership | null;
  isMembershipLoading: boolean;
  // Auth actions
  signIn: (email: string, password: string) => Promise<{ data: { user: AuthUser | null; session: Session | null }; error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ user: AuthUser | null; session: Session | null; error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  // Cache helpers
  refreshMembership: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enrichUser(u: User | null | undefined): AuthUser | null {
  if (!u) return null;
  const meta = u.user_metadata as Record<string, string> | undefined;
  return {
    ...u,
    name: meta?.full_name ?? meta?.name ?? undefined,
    avatar: meta?.avatar_url ?? undefined,
    full_name: meta?.full_name ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Membership cache (AsyncStorage-backed, 5-minute TTL)
// ---------------------------------------------------------------------------

const MEMBERSHIP_CACHE_PREFIX = '@autopilot_membership:';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadCachedMembership(
  userId: string
): Promise<UserMembership | null> {
  try {
    const raw = await AsyncStorage.getItem(`${MEMBERSHIP_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw) as {
      data: UserMembership;
      timestamp: number;
    };
    if (Date.now() - timestamp < CACHE_TTL_MS) return data;
  } catch {
    // Corrupt cache entry — treat as miss
  }
  return null;
}

async function persistMembershipCache(
  userId: string,
  data: UserMembership
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${MEMBERSHIP_CACHE_PREFIX}${userId}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // Storage error — non-fatal
  }
}

async function clearMembershipCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${MEMBERSHIP_CACHE_PREFIX}${userId}`);
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membership, setMembership] = useState<UserMembership | null>(null);
  const [isMembershipLoading, setIsMembershipLoading] = useState(false);

  // Prevents duplicate parallel membership fetches within the same render pass
  const fetchingRef = useRef(false);

  const supabase = useMemo(() => createClient(), []);

  // ---------------------------------------------------------------------------
  // fetchMembership — queries org + property memberships, caches result
  // ---------------------------------------------------------------------------
  const fetchMembership = useCallback(
    async (userId: string) => {
      if (fetchingRef.current) return;

      // Fast path: return cached data without a loading state flash
      const cached = await loadCachedMembership(userId);
      if (cached) {
        setMembership(cached);
        return;
      }

      fetchingRef.current = true;
      setIsMembershipLoading(true);

      try {
        // Fetch organisation membership
        const { data: orgData } = await supabase
          .from('organization_memberships')
          .select(
            `
            role,
            organization:organizations (
              id,
              name
            )
          `
          )
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        // Fetch all property memberships for this user
        const { data: propData } = await supabase
          .from('property_memberships')
          .select(
            `
            role,
            property:properties (
              id,
              name,
              code
            )
          `
          )
          .eq('user_id', userId)
          .eq('is_active', true);

        const builtProperties: PropertyInfo[] = (propData ?? [])
          .map((p: any) => {
            const prop = p.property as any;
            if (!prop?.id) return null;
            return {
              id: prop.id as string,
              name: (prop.name as string) ?? '',
              code: (prop.code as string) ?? '',
              role: (p.role as string) ?? 'member',
            };
          })
          .filter((p: PropertyInfo | null): p is PropertyInfo => p !== null);

        console.log('[AuthContext] property memberships raw:', JSON.stringify(propData));
        console.log('[AuthContext] builtProperties:', JSON.stringify(builtProperties));

        const membershipData: UserMembership = {
          org_id: ((orgData as any)?.organization)?.id ?? null,
          org_name: ((orgData as any)?.organization)?.name ?? null,
          org_role: (orgData as any)?.role ?? null,
          properties: builtProperties,
        };

        await persistMembershipCache(userId, membershipData);
        setMembership(membershipData);
      } catch (err) {
        console.error('[AuthContext] fetchMembership error:', err);
      } finally {
        fetchingRef.current = false;
        setIsMembershipLoading(false);
      }
    },
    [supabase]
  );

  // ---------------------------------------------------------------------------
  // refreshMembership — clears cache and re-fetches
  // ---------------------------------------------------------------------------
  const refreshMembership = useCallback(async () => {
    if (user?.id) {
      await clearMembershipCache(user.id);
      await fetchMembership(user.id);
    }
  }, [user?.id, fetchMembership]);

  // ---------------------------------------------------------------------------
  // Auth state initialisation + onAuthStateChange subscription
  // ---------------------------------------------------------------------------
  useEffect(() => {
    console.log('[AuthContext] useEffect firing — fetching session...');
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (error) {
          console.error('[AuthContext] getSession error:', error.message);
          // If the token is invalid, we must sign out to clear the corrupted session from storage
          if (error.message.includes('refresh_token_not_found') || error.message.includes('Invalid Refresh Token')) {
             supabase.auth.signOut().catch(() => {});
             setSession(null);
             setUser(null);
          }
          setIsLoading(false);
          return;
        }

        console.log('[AuthContext] getSession result:', initialSession ? `user=${initialSession.user?.email}` : 'null session');
        setSession(initialSession);
        setUser(enrichUser(initialSession?.user ?? null));
        if (initialSession?.user) {
          fetchMembership(initialSession.user.id);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('[AuthContext] getSession exception:', err);
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(enrichUser(nextSession?.user ?? null));

      if (event === 'SIGNED_IN' && nextSession?.user) {
        fetchMembership(nextSession.user.id);
        // Pre-warm Cassandra token — non-fatal if it fails
        getValidToken().catch((e) => console.warn('[Auth] Cassandra token pre-warm failed:', e));
      } else if (event === 'SIGNED_OUT') {
        setMembership(null);
        clearToken().catch(() => {});
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchMembership]);

  // ---------------------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------------------

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { data: { user: null, session: null }, error: error.message };
      }

      // State is also updated via onAuthStateChange, but we update immediately
      // so callers can rely on the returned session right away.
      const enrichedUser = enrichUser(data.session.user);
      setSession(data.session);
      setUser(enrichedUser);

      await fetchMembership(data.session.user.id);
      // Pre-warm Cassandra token — non-fatal if it fails
      getValidToken().catch((e) => console.warn('[Auth] Cassandra token pre-warm failed:', e));

      return { data: { user: enrichedUser, session: data.session }, error: null };
    },
    [supabase, fetchMembership]
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        return { user: null, session: null, error: error.message };
      }

      if (data.session) {
        const enrichedUser = enrichUser(data.session.user);
        setSession(data.session);
        setUser(enrichedUser);

        // ─── Create users profile row (mirrors web app auth callback) ───
        // This must exist before onboarding tries to .update() it.
        await supabase.from('users').upsert({
          id: data.session.user.id,
          email: email,
          full_name: fullName,
        }, { onConflict: 'id' });

        await fetchMembership(data.session.user.id);
        // Pre-warm Cassandra token — non-fatal if it fails
        getValidToken().catch((e) => console.warn('[Auth] Cassandra token pre-warm failed:', e));
      }

      return {
        user: enrichUser(data.user ?? null),
        session: data.session,
        error: null,
      };
    },
    [supabase, fetchMembership]
  );

  const signOut = useCallback(async () => {
    if (user?.id) {
      await clearMembershipCache(user.id);
    }
    setMembership(null);
    await supabase.auth.signOut();
  }, [supabase, user?.id]);

  const resetPassword = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw new Error(error.message);
    },
    [supabase]
  );

  // ---------------------------------------------------------------------------
  // Context value (memoised to prevent unnecessary re-renders)
  // ---------------------------------------------------------------------------
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isLoading,
      membership,
      isMembershipLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshMembership,
    }),
    [
      user,
      session,
      isLoading,
      membership,
      isMembershipLoading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      refreshMembership,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
