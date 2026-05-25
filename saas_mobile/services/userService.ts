// ============================================
// User Service — routes through saas_mobile_server
// ============================================

import { serverApi } from '@/lib/serverApi';
import { apiClient, ApiResponse } from './api/client';
import { supabase } from '@/utils/supabase/client';
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
  // Get all users (uses dedicated /api/users/list)
  async getUsers(filters?: UserFilters): Promise<ApiResponse<User[]>> {
    try {
      const params = new URLSearchParams();
      if (filters?.propertyId) params.append('propertyId', filters.propertyId);
      if (filters?.organizationId) params.append('orgId', filters.organizationId);

      const res = await serverApi.get<any>(`/api/users/list?${params.toString()}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch users');
      return { data: res.data?.users ?? [], error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Get single user
  async getUser(id: string): Promise<ApiResponse<User>> {
    try {
      const res = await serverApi.get<any>(`/api/users/${id}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch user');
      return { data: res.data ?? null, error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Create user (admin only)
  async createUser(data: CreateUserData): Promise<ApiResponse<User>> {
    try {
      const res = await serverApi.post<any>('/api/users/create', {
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        organizationId: data.organizationId,
        propertyId: data.propertyId,
        phone: data.phone,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to create user');
      return { data: res.data ?? null, error: null, status: 201 };
    } catch (error) {
      return { data: null, error: error as Error, status: 400 };
    }
  },

  // Update user
  async updateUser(id: string, data: UpdateUserData): Promise<ApiResponse<User>> {
    const updateData: Record<string, any> = {};
    if (data.fullName !== undefined) updateData.full_name = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    updateData.updated_at = new Date().toISOString();

    return apiClient.put<User>('users', id, updateData);
  },

  // Update user role
  async updateRole(userId: string, role: UserRole, propertyId?: string, organizationId?: string): Promise<ApiResponse<User>> {
    try {
      const res = await serverApi.post<any>('/api/users/update-role', {
        userId,
        role,
        propertyId,
        organizationId,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to update role');
      return { data: res.data ?? null, error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
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
      const res = await serverApi.post<void>('/api/users/hard-delete', { id });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to hard delete user');
      return { data: undefined, error: null, status: 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Assign property to user
  async assignProperty(userId: string, propertyId: string, role?: UserRole): Promise<ApiResponse<User>> {
    return this.updateRole(userId, role ?? 'tenant', propertyId);
  },

  // Get user statistics
  async getUserStats(organizationId?: string): Promise<ApiResponse<any>> {
    try {
      const res = await serverApi.query<any[]>({
        table: 'users',
        action: 'select',
        select: '*, property_memberships(role, is_active)',
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stats');
      const rows = res.data ?? [];
      return {
        data: { total: rows.length, byRole: {}, active: 0, inactive: 0 },
        error: null,
        status: 200,
      };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },

  // Invite user by email
  async inviteUser(email: string, role: UserRole, organizationId?: string, propertyId?: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email, role, organizationId, propertyId },
      });
      return { data: undefined, error, status: error ? 400 : 200 };
    } catch (error) {
      return { data: null, error: error as Error, status: 500 };
    }
  },
};

export default userService;
