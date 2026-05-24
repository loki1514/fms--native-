import { supabase } from '@/utils/supabase';
import { ApiResponse } from './api/client';
import type { Property, Organization } from '@/types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function mapProperty(row: Record<string, unknown>): Property {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    type: row.type as Property['type'],
    address: row.address as string,
    city: row.city as string,
    state: row.state as string,
    zip: row.zip as string,
    phone: row.phone as string,
    email: row.email as string,
    status: (row.status ?? 'active') as Property['status'],
    totalUnits: (row.total_units ?? 0) as number,
    occupiedUnits: (row.occupied_units ?? 0) as number,
    amenities: (row.amenities ?? []) as string[],
    code: row.code as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function ok<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

function err<T>(error: string): ApiResponse<T> {
  return { data: null as unknown as T, error };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const propertyService = {
  // List properties the current user has access to
  async getProperties(
    filters?: { search?: string; organizationId?: string; status?: string }
  ): Promise<ApiResponse<Property[]>> {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return err('Not authenticated');

      // Get property IDs the user has active membership in
      const { data: memberships, error: memError }: any = await (supabase as any)
        .from('property_memberships')
        .select('property_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (memError) return err(memError?.message ?? 'Failed to fetch properties');

      const propertyIds = (memberships ?? []).map((m: Record<string, unknown>) => m.property_id as string);
      if (propertyIds.length === 0) return ok([]);

      let query = (supabase as any)
        .from('properties')
        .select(
          `id, organization_id, name, type, address, city, state, zip,
          phone, email, status, total_units, occupied_units, amenities,
          code, created_at, updated_at`
        )
        .in('id', propertyIds);

      if (filters?.organizationId) {
        query = query.eq('organization_id', filters.organizationId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) return err(error?.message ?? 'Failed to fetch properties');
      return ok((data ?? []).map(mapProperty));
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to fetch properties');
    }
  },

  // Get a single property by ID
  async getProperty(id: string): Promise<ApiResponse<Property>> {
    try {
      const { data, error } = await (supabase as any)
        .from('properties')
        .select(
          `
          id, organization_id, name, type, address, city, state, zip,
          phone, email, status, total_units, occupied_units, amenities,
          code, created_at, updated_at
          `
        )
        .eq('id', id)
        .single();

      if (error) return err(error?.message ?? 'Failed to fetch property');
      return ok(mapProperty(data!));
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to fetch property');
    }
  },

  // Create a new property
  async createProperty(data: Partial<Property>): Promise<ApiResponse<Property>> {
    try {
      const payload: Record<string, unknown> = {};

      if (data.organizationId !== undefined) payload.organization_id = data.organizationId;
      if (data.name !== undefined) payload.name = data.name;
      if (data.type !== undefined) payload.type = data.type;
      if (data.address !== undefined) payload.address = data.address;
      if (data.city !== undefined) payload.city = data.city;
      if (data.state !== undefined) payload.state = data.state;
      if (data.zip !== undefined) payload.zip = data.zip;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.email !== undefined) payload.email = data.email;
      if (data.status !== undefined) payload.status = data.status;
      if (data.totalUnits !== undefined) payload.total_units = data.totalUnits;
      if (data.occupiedUnits !== undefined) payload.occupied_units = data.occupiedUnits;
      if (data.amenities !== undefined) payload.amenities = data.amenities;
      if (data.code !== undefined) payload.code = data.code;

      const { data: row, error } = await (supabase as any)
        .from('properties')
        .insert(payload)
        .select()
        .single();

      if (error) return err(error?.message ?? 'Failed to create property');
      return ok(mapProperty(row as Record<string, unknown>));
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to create property');
    }
  },

  // Update an existing property
  async updateProperty(
    id: string,
    data: Partial<Property>
  ): Promise<ApiResponse<Property>> {
    try {
      const payload: Record<string, unknown> = {};

      if (data.organizationId !== undefined) payload.organization_id = data.organizationId;
      if (data.name !== undefined) payload.name = data.name;
      if (data.type !== undefined) payload.type = data.type;
      if (data.address !== undefined) payload.address = data.address;
      if (data.city !== undefined) payload.city = data.city;
      if (data.state !== undefined) payload.state = data.state;
      if (data.zip !== undefined) payload.zip = data.zip;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.email !== undefined) payload.email = data.email;
      if (data.status !== undefined) payload.status = data.status;
      if (data.totalUnits !== undefined) payload.total_units = data.totalUnits;
      if (data.occupiedUnits !== undefined) payload.occupied_units = data.occupiedUnits;
      if (data.amenities !== undefined) payload.amenities = data.amenities;
      if (data.code !== undefined) payload.code = data.code;

      const { data: row, error } = await (supabase as any)
        .from('properties')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error?.message ?? 'Failed to update property');
      return ok(mapProperty(row as Record<string, unknown>));
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to update property');
    }
  },

  // Delete a property
  async deleteProperty(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await (supabase as any).from('properties').delete().eq('id', id);
      if (error) return err(error?.message ?? 'Failed to delete property');
      return ok(undefined as void);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to delete property');
    }
  },

  // Get enabled modules/features for a property from the parent organization
  async getPropertyFeatures(
    propertyId: string
  ): Promise<ApiResponse<{ module: string; enabled: boolean }[]>> {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return err('Not authenticated');

      const { data: prop, error: propError } = await (supabase as any)
        .from('properties')
        .select('organization_id')
        .eq('id', propertyId)
        .single();

      if (propError) return err(propError?.message ?? 'Failed to fetch property features');

      const { data: org, error: orgError } = await (supabase as any)
        .from('organizations')
        .select('available_modules')
        .eq('id', (prop as Record<string, unknown>).organization_id)
        .single();

      if (orgError) return err(orgError?.message ?? 'Failed to fetch organization features');

      const modules: { module: string; enabled: boolean }[] = (
        ((org as Record<string, unknown>).available_modules ?? []) as string[]
      ).map((m: string) => ({ module: m, enabled: true }));

      return ok(modules);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to fetch property features');
    }
  },

  // Update enabled modules for a property (stored on the organization)
  async updatePropertyFeatures(
    propertyId: string,
    features: Record<string, boolean>
  ): Promise<ApiResponse<void>> {
    try {
      const { data: prop, error: propError } = await (supabase as any)
        .from('properties')
        .select('organization_id')
        .eq('id', propertyId)
        .single();

      if (propError) return err(propError?.message ?? 'Failed to fetch property');

      const enabledModules = Object.entries(features)
        .filter(([, enabled]) => enabled)
        .map(([module]) => module);

      const { error } = await (supabase as any)
        .from('organizations')
        .update({ available_modules: enabledModules })
        .eq('id', (prop as Record<string, unknown>).organization_id);

      if (error) return err(error?.message ?? 'Failed to update property features');
      return ok(undefined as void);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to update property features');
    }
  },

  // Join a property using its invite code
  async joinProperty(
    code: string
  ): Promise<ApiResponse<{ property: Property; organization: Organization }>> {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return err('Not authenticated');

      const { data: prop, error: propError } = await (supabase as any)
        .from('properties')
        .select(
          `
          id, organization_id, name, type, address, city, state, zip,
          phone, email, status, total_units, occupied_units, amenities,
          code, created_at, updated_at
          `
        )
        .eq('code', code)
        .single();

      if (propError) return err('Invalid or expired property code');

      const { data: org, error: orgError } = await (supabase as any)
        .from('organizations')
        .select('id, name, slug, logo_url, address, phone, email, created_at, updated_at')
        .eq('id', (prop as Record<string, unknown>).organization_id)
        .single();

      if (orgError) return err(orgError?.message ?? 'Failed to fetch organization');

      // Upsert membership so the user can access the property
      const { error: memberError } = await (supabase as any)
        .from('property_memberships')
        .upsert(
          { user_id: userId, property_id: (prop as Record<string, unknown>).id, role: 'member', is_active: true },
          { onConflict: 'user_id,property_id' }
        );

      if (memberError) return err(memberError?.message ?? 'Failed to join property');

      return ok({
        property: mapProperty(prop as Record<string, unknown>),
        organization: {
          id: (org as Record<string, unknown>).id as string,
          name: (org as Record<string, unknown>).name as string,
          slug: (org as Record<string, unknown>).slug as string,
          logoUrl: (org as Record<string, unknown>).logo_url as string | undefined,
          address: (org as Record<string, unknown>).address as string | undefined,
          phone: (org as Record<string, unknown>).phone as string | undefined,
          email: (org as Record<string, unknown>).email as string | undefined,
          settings: {
            timezone: 'UTC',
            currency: 'USD',
            dateFormat: 'YYYY-MM-DD',
            features: [],
          } as import('@/types').OrganizationSettings,
          createdAt: (org as Record<string, unknown>).created_at as string,
          updatedAt: (org as Record<string, unknown>).updated_at as string,
        },
      } as { property: Property; organization: Organization });
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to join property');
    }
  },
};
