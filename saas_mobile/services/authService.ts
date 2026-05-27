// ============================================
// Auth Service - Authentication Operations
// ============================================

import { supabase } from '@/utils/supabase/client';
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
      const res = await apiClient.post<{ user: User; session: any }>('auth/login', credentials);
      if (res.error) throw new Error(res.error as string);
      return { data: res.data ?? null, error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 401 };
    }
  },

  // Sign up new user
  async signup(data: SignupData): Promise<ApiResponse<{ user: User }>> {
    try {
      const res = await apiClient.post<{ user: User; session: any }>('auth/signup', data);
      if (res.error) {
        return { data: null, error: new Error(res.error as string), status: 400 };
      }
      return { data: { user: res.data?.user as User }, error: null, status: 201 };
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
      const res = await apiClient.post<void>('auth/logout', {});
      if (res.error) {
        return { data: null, error: new Error(res.error as string), status: 500 };
      }
      return { data: undefined, error: null, status: 200 };
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
      const res = await apiClient.post<void>('auth/reset-password', { email: data.email });
      if (res.error) {
        return { data: null, error: new Error(res.error as string), status: 400 };
      }
      return { data: undefined, error: null, status: 200 };
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
      const res = await apiClient.post<void>('auth/update-user', { password: data.password });
      if (res.error) {
        return { data: null, error: new Error(res.error as string), status: 400 };
      }
      return { data: undefined, error: null, status: 200 };
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
      const res = await apiClient.get<{ user: User; session: any }>('auth/session');
      if (res.error) {
        return { data: null, error: new Error(res.error as string), status: 401 };
      }
      return { data: res.data ?? null, error: null, status: 200 };
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
