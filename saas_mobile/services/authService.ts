// ============================================
// Auth Service - Authentication Operations
// ============================================

import { supabase } from '@/utils/supabase';
import { apiClient, ApiResponse } from './api/client';
import { User, UserRole } from '@/types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
  organizationId?: string;
  propertyId?: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface UpdatePasswordData {
  password: string;
}

export const authService = {
  // Login with email/password
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; session: any }>> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;

      // Fetch user profile
      const { data: profile, error: profileError } = (await supabase
        .from('users')
        .select('*')
        .eq('id', data.user?.id)
        .single() as any) as { data: Record<string, unknown> | null; error: unknown };

      if (profileError) throw profileError;

      return {
        data: {
          user: profile as unknown as User,
          session: data.session,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 401,
      };
    }
  },

  // Sign up new user
  async signup(data: SignupData): Promise<ApiResponse<{ user: User }>> {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
        },
      });

      if (error) throw error;

      // Create user profile
      const { data: profile, error: profileError }: any = await (supabase as any)
        .from('users')
        .insert({
          id: authData.user?.id,
          email: data.email,
          full_name: data.fullName,
          organization_id: data.organizationId,
          property_id: data.propertyId,
          role: 'tenant',
        })
        .select()
        .single();

      if (profileError) throw profileError;

      return {
        data: { user: profile as unknown as User },
        error: null,
        status: 201,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 400,
      };
    }
  },

  // Logout
  async logout(): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      return {
        data: undefined,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // Forgot password
  async forgotPassword(data: ResetPasswordData): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: 'autopilot://reset-password',
      });

      if (error) throw error;

      return {
        data: undefined,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 400,
      };
    }
  },

  // Update password
  async updatePassword(data: UpdatePasswordData): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) throw error;

      return {
        data: undefined,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 400,
      };
    }
  },

  // Get current session
  async getSession(): Promise<ApiResponse<{ user: User | null; session: any }>> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session) {
        return {
          data: { user: null, session: null },
          error: null,
          status: 200,
        };
      }

      // Fetch user profile
      const { data: profile, error: profileError } = (await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single() as any) as { data: Record<string, unknown> | null; error: unknown };

      if (profileError) throw profileError;

      return {
        data: {
          user: profile as unknown as User,
          session,
        },
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 401,
      };
    }
  },

  // Google OAuth
  async signInWithGoogle(): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'autopilot://callback',
        },
      });

      if (error) throw error;

      return {
        data: undefined,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 400,
      };
    }
  },

  // Zoho OAuth (if configured)
  async signInWithZoho(): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google' as any,
        options: {
          redirectTo: 'autopilot://callback',
        },
      });

      if (error) throw error;

      return {
        data: undefined,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 400,
      };
    }
  },

  // Refresh session
  async refreshSession(): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;

      return {
        data: undefined,
        error: null,
        status: 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 401,
      };
    }
  },
};

export default authService;
