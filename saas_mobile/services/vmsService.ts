import { supabase } from '@/utils/supabase';
import { ApiResponse } from './api/client';
import type { Visitor, VisitorStatus } from '@/types';

function mapDbToVisitor(row: Record<string, unknown>): Visitor {
  const expectedDate = (row.expected_date as string) || '';
  const expectedTime = (row.expected_time as string) || '';
  const expectedDateTime = expectedDate && expectedTime
    ? `${expectedDate}T${expectedTime}`
    : expectedDate || '';

  return {
    id: row.id as string,
    visitorId: row.visitor_id as string,
    name: row.visitor_name as string,
    email: (row.email as string) || '',
    phone: row.mobile as string,
    company: (row.company as string) || '',
    purpose: (row.purpose as string) || '',
    hostName: row.whom_to_meet as string,
    hostId: (row.host_id as string) || '',
    checkInTime: (row.checkin_time as string) || '',
    checkOutTime: (row.checkout_time as string) || '',
    expectedTime: expectedDateTime,
    status: row.status as VisitorStatus,
    photo: (row.photo_url as string) || '',
    idProof: (row.id_proof_url as string) || '',
    passCode: (row.pass_code as string) || '',
    vehicleNumber: (row.vehicle_number as string) || '',
    belongings: (row.belongings as string) || '',
    propertyId: (row.property_id as string) || '',
    preRegistered: Boolean(row.pre_registered),
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

export const vmsService = {
  async getVisitors(filters?: {
    propertyId?: string;
    search?: string;
    status?: VisitorStatus;
    date?: string;
  }): Promise<ApiResponse<Visitor[]>> {
    try {
      let query = (supabase
        .from('visitor_logs')
        .select('*')
        .order('created_at', { ascending: false }) as any);

      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.date) {
        query = query.eq('expected_date', filters.date);
      }
      if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(
          `visitor_name.ilike.${term},email.ilike.${term},mobile.ilike.${term},company.ilike.${term},whom_to_meet.ilike.${term}`,
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: (data || []).map(mapDbToVisitor) };
    } catch (err) {
      console.error('vmsService.getVisitors:', err);
      return { success: false, data: [], error: null };
    }
  },

  async getVisitor(id: string): Promise<ApiResponse<Visitor>> {
    try {
      const { data, error } = (await (supabase
        .from('visitor_logs')
        .select('*')
        .eq('id', id)
        .single() as any)) as { data: Record<string, unknown> | null; error: unknown };

      if (error) throw error;

      return { success: true, data: mapDbToVisitor(data as Record<string, unknown>) };
    } catch (err) {
      console.error('vmsService.getVisitor:', err);
      return { success: false, data: null as unknown as Visitor, error: null };
    }
  },

  async createVisitor(data: Partial<Visitor>): Promise<ApiResponse<Visitor>> {
    try {
      const payload: Record<string, unknown> = {
        visitor_id: data.visitorId || null,
        visitor_name: data.name,
        email: data.email || null,
        mobile: data.phone || null,
        company: data.company || null,
        purpose: data.purpose || null,
        whom_to_meet: data.hostName || null,
        host_id: data.hostId || null,
        checkin_time: data.checkInTime || null,
        checkout_time: data.checkOutTime || null,
        expected_date: data.expectedTime ? data.expectedTime.split('T')[0] : null,
        expected_time: data.expectedTime ? data.expectedTime.split('T')[1] || null : null,
        status: data.status || 'expected',
        photo_url: data.photo || null,
        id_proof_url: data.idProof || null,
        pass_code: data.passCode || null,
        vehicle_number: data.vehicleNumber || null,
        belongings: data.belongings || null,
        property_id: data.propertyId || null,
        pre_registered: data.preRegistered ?? true,
      };

      const { data: row, error }: any = await (supabase as any)
        .from('visitor_logs')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: row ? mapDbToVisitor(row as Record<string, unknown>) : null };
    } catch (err) {
      console.error('vmsService.createVisitor:', err);
      return { success: false, data: null as unknown as Visitor, error: null };
    }
  },

  async updateVisitor(id: string, data: Partial<Visitor>): Promise<ApiResponse<Visitor>> {
    try {
      const payload: Record<string, unknown> = {};

      if (data.name !== undefined) payload.visitor_name = data.name;
      if (data.email !== undefined) payload.email = data.email;
      if (data.phone !== undefined) payload.mobile = data.phone;
      if (data.company !== undefined) payload.company = data.company;
      if (data.purpose !== undefined) payload.purpose = data.purpose;
      if (data.hostName !== undefined) payload.whom_to_meet = data.hostName;
      if (data.hostId !== undefined) payload.host_id = data.hostId;
      if (data.checkInTime !== undefined) payload.checkin_time = data.checkInTime;
      if (data.checkOutTime !== undefined) payload.checkout_time = data.checkOutTime;
      if (data.expectedTime !== undefined) {
        payload.expected_date = data.expectedTime.split('T')[0];
        payload.expected_time = data.expectedTime.split('T')[1] || null;
      }
      if (data.status !== undefined) payload.status = data.status;
      if (data.photo !== undefined) payload.photo_url = data.photo;
      if (data.idProof !== undefined) payload.id_proof_url = data.idProof;
      if (data.passCode !== undefined) payload.pass_code = data.passCode;
      if (data.vehicleNumber !== undefined) payload.vehicle_number = data.vehicleNumber;
      if (data.belongings !== undefined) payload.belongings = data.belongings;
      if (data.propertyId !== undefined) payload.property_id = data.propertyId;
      if (data.preRegistered !== undefined) payload.pre_registered = data.preRegistered;

      const { data: row, error }: any = await (supabase as any)
        .from('visitor_logs')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: row ? mapDbToVisitor(row as Record<string, unknown>) : null };
    } catch (err) {
      console.error('vmsService.updateVisitor:', err);
      return { success: false, data: null as unknown as Visitor, error: null };
    }
  },

  async checkIn(id: string, photoUrl?: string): Promise<ApiResponse<Visitor>> {
    try {
      const payload: Record<string, unknown> = {
        checkin_time: new Date().toISOString(),
        status: 'checked_in',
      };
      if (photoUrl) payload.photo_url = photoUrl;

      const { data, error }: any = await (supabase as any)
        .from('visitor_logs')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: data ? mapDbToVisitor(data as Record<string, unknown>) : null };
    } catch (err) {
      console.error('vmsService.checkIn:', err);
      return { success: false, data: null as unknown as Visitor, error: null };
    }
  },

  async checkOut(id: string): Promise<ApiResponse<Visitor>> {
    try {
      const { data, error }: any = await (supabase as any)
        .from('visitor_logs')
        .update({
          checkout_time: new Date().toISOString(),
          status: 'checked_out',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: data ? mapDbToVisitor(data as Record<string, unknown>) : null };
    } catch (err) {
      console.error('vmsService.checkOut:', err);
      return { success: false, data: null as unknown as Visitor, error: null };
    }
  },

  async forceCheckout(id: string): Promise<ApiResponse<Visitor>> {
    return this.checkOut(id);
  },

  async kioskRegister(data: {
    visitorName: string;
    mobile: string;
    purpose: string;
    whomToMeet: string;
    propertyId: string;
  }): Promise<ApiResponse<Visitor>> {
    try {
      const now = new Date().toISOString();

      const payload: Record<string, unknown> = {
        visitor_name: data.visitorName,
        mobile: data.mobile,
        purpose: data.purpose,
        whom_to_meet: data.whomToMeet,
        property_id: data.propertyId,
        status: 'checked_in',
        checkin_time: now,
        pre_registered: false,
      };

      const { data: row, error }: any = await (supabase as any)
        .from('visitor_logs')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: row ? mapDbToVisitor(row as Record<string, unknown>) : null };
    } catch (err) {
      console.error('vmsService.kioskRegister:', err);
      return { success: false, data: null as unknown as Visitor, error: null };
    }
  },
};
