// ============================================
// User Service - User Management Operations
// ============================================

import { apiClient, ApiResponse } from './api/client';
import { supabase } from '@/utils/supabase';
import { User, UserRole } from '@/types';

export interface CreateUserData {
  email: string;
  fullName: string;
  role: UserRole;
  organizationId?: string;
  propertyId?: string;
  phone?: string;
}

export interface UpdateUserData {
  fullName?: string;
  role?: UserRole;
  organizationId?: string;
  propertyId?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UserFilters {
  organizationId?: string;
  propertyId?: string;
  role?: UserRole | UserRole[];
  isActive?: boolean;
  search?: string;
}

export const userService = {
  // Get all users with filters
  async getUsers(
    filters?: UserFilters,
    options?: {
      orderBy?: string;
      ascending?: boolean;
      limit?: number;
    }
  ): Promise<ApiResponse<User[]>> {
    let query = supabase
      .from('users')
      .select('*, organization:organizations(name), property:properties(name)');

    // Apply filters
    if (filters?.organizationId) {
      query = query.eq('organization_id', filters.organizationId);
    }

    if (filters?.propertyId) {
      query = query.eq('property_id', filters.propertyId);
    }

    if (filters?.role) {
      if (Array.isArray(filters.role)) {
        query = query.in('role', filters.role);
      } else {
        query = query.eq('role', filters.role);
      }
    }

    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.ascending ?? true,
      });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply limit
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    return {
      data: data as User[] | null,
      error,
      status: error ? 400 : 200,
    };
  },

  // Get single user
  async getUser(id: string): Promise<ApiResponse<User>> {
    const { data, error } = await supabase
      .from('users')
      .select('*, organization:organizations(name), property:properties(name)')
      .eq('id', id)
      .single();

    return {
      data: data as User | null,
      error,
      status: error ? 400 : 200,
    };
  },

  // Create user (admin only)
  async createUser(data: CreateUserData): Promise<ApiResponse<User>> {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        user_metadata: {
          full_name: data.fullName,
        },
      });

      if (authError) throw authError;

      // Create user profile
      const { data: rawProfile, error: profileError } = (await (supabase
        .from('users') as any)
        .insert({
          id: authData.user.id,
          email: data.email,
          full_name: data.fullName,
          role: data.role,
          organization_id: data.organizationId,
          property_id: data.propertyId,
          phone: data.phone,
          is_active: true,
        })
        .select()
        .single()) as { data: unknown; error: unknown };

      if (profileError) throw profileError;

      return {
        data: rawProfile as User,
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

  // Update user
  async updateUser(id: string, data: UpdateUserData): Promise<ApiResponse<User>> {
    const updateData: Record<string, any> = {};

    if (data.fullName !== undefined) updateData.full_name = data.fullName;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.organizationId !== undefined) updateData.organization_id = data.organizationId;
    if (data.propertyId !== undefined) updateData.property_id = data.propertyId;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    updateData.updated_at = new Date().toISOString();

    return apiClient.put<User>('users', id, updateData);
  },

  // Delete user (soft delete)
  async deleteUser(id: string): Promise<ApiResponse<User>> {
    return apiClient.put<User>('users', id, {
      is_active: false,
      deleted_at: new Date().toISOString(),
    });
  },

  // Hard delete user (admin only)
  async hardDeleteUser(id: string): Promise<ApiResponse<void>> {
    try {
      // Delete from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(id);
      if (authError) throw authError;

      // Delete from users table
      const { error } = await supabase.from('users').delete().eq('id', id);

      return {
        data: undefined,
        error,
        status: error ? 400 : 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // Assign property to user
  async assignProperty(userId: string, propertyId: string): Promise<ApiResponse<User>> {
    return this.updateUser(userId, { propertyId });
  },

  // Update user role
  async updateRole(userId: string, role: UserRole): Promise<ApiResponse<User>> {
    return this.updateUser(userId, { role });
  },

  // Send welcome email
  async sendWelcomeEmail(userId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.functions.invoke('send-welcome-email', {
        body: { userId },
      });

      return {
        data: undefined,
        error,
        status: error ? 400 : 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // Reset user password
  async resetPassword(userId: string): Promise<ApiResponse<void>> {
    try {
      const { data: rawUser, error: userError } = (await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()) as { data: unknown; error: unknown };

      if (userError) throw userError;

      const user = rawUser as { email: string };

      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: 'autopilot://reset-password',
      });

      return {
        data: undefined,
        error,
        status: error ? 400 : 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },

  // Get user statistics
  async getUserStats(
    organizationId?: string
  ): Promise<ApiResponse<{
    total: number;
    byRole: Record<UserRole, number>;
    active: number;
    inactive: number;
  }>> {
    try {
      let query = supabase.from('users').select('role, is_active');

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const rows = (data ?? []) as unknown as { role: string; is_active: boolean }[];

      const stats = {
        total: rows.length,
        byRole: {} as Record<UserRole, number>,
        active: 0,
        inactive: 0,
      };

      rows.forEach((user) => {
        // Count by role
        if (user.role) {
          stats.byRole[user.role as UserRole] = (stats.byRole[user.role as UserRole] || 0) + 1;
        }
        // Count active/inactive
        if (user.is_active) {
          stats.active++;
        } else {
          stats.inactive++;
        }
      });

      return {
        data: stats,
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

  // Invite user by email
  async inviteUser(
    email: string,
    role: UserRole,
    organizationId?: string,
    propertyId?: string
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: {
          email,
          role,
          organizationId,
          propertyId,
        },
      });

      return {
        data: undefined,
        error,
        status: error ? 400 : 200,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
        status: 500,
      };
    }
  },
};

export default userService;
