import { supabase } from '@/utils/supabase/client';
import { ApiResponse } from './api/client';
import type { Visitor, VisitorStatus } from '@/types';

function mapDbToVisitor(row: Record<string, unknown>): Visitor {
  // TODO: expected_date and expected_time do not exist on visitor_logs
  // const expectedDate = (row.expected_date as string) || '';
  // const expectedTime = (row.expected_time as string) || '';
  // const expectedDateTime = expectedDate && expectedTime
  //   ? `${expectedDate}T${expectedTime}`
  //   : expectedDate || '';

  return {
    id: row.id as string,
    visitorId: row.visitor_id as string,
    name: row.name as string, // mapped from visitor_name -> name
    // TODO: email does not exist on visitor_logs
    email: '',
    phone: row.mobile as string,
    company: (row.coming_from as string) || '', // mapped from company -> coming_from
    // TODO: purpose does not exist on visitor_logs
    purpose: '',
    hostName: row.whom_to_meet as string,
    // TODO: host_id does not exist on visitor_logs
    hostId: '',
    checkInTime: (row.checkin_time as string) || '',
    checkOutTime: (row.checkout_time as string) || '',
    expectedTime: '',
    status: row.status as VisitorStatus,
    photo: (row.photo_url as string) || '',
    // TODO: id_proof_url does not exist on visitor_logs
    idProof: '',
    // TODO: pass_code does not exist on visitor_logs
    passCode: '',
    // TODO: vehicle_number does not exist on visitor_logs
    vehicleNumber: '',
    // TODO: belongings does not exist on visitor_logs
    belongings: '',
    propertyId: (row.property_id as string) || '',
    // TODO: pre_registered does not exist on visitor_logs
    preRegistered: false,
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
      // TODO: expected_date does not exist on visitor_logs
      // if (filters?.date) {
      //   query = query.eq('expected_date', filters.date);
      // }
      if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(
          `name.ilike.${term},mobile.ilike.${term},coming_from.ilike.${term},whom_to_meet.ilike.${term}`,
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
        name: data.name, // mapped from visitor_name -> name
        mobile: data.phone || null,
        coming_from: data.company || null, // mapped from company -> coming_from
        whom_to_meet: data.hostName || null,
        checkin_time: data.checkInTime || null,
        checkout_time: data.checkOutTime || null,
        status: data.status || 'expected',
        photo_url: data.photo || null,
        property_id: data.propertyId || null,
        // TODO: the following columns do not exist on visitor_logs
        // email: data.email || null,
        // purpose: data.purpose || null,
        // host_id: data.hostId || null,
        // expected_date: data.expectedTime ? data.expectedTime.split('T')[0] : null,
        // expected_time: data.expectedTime ? data.expectedTime.split('T')[1] || null : null,
        // id_proof_url: data.idProof || null,
        // pass_code: data.passCode || null,
        // vehicle_number: data.vehicleNumber || null,
        // belongings: data.belongings || null,
        // pre_registered: data.preRegistered ?? true,
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

      if (data.name !== undefined) payload.name = data.name;
      if (data.phone !== undefined) payload.mobile = data.phone;
      if (data.company !== undefined) payload.coming_from = data.company;
      if (data.hostName !== undefined) payload.whom_to_meet = data.hostName;
      if (data.checkInTime !== undefined) payload.checkin_time = data.checkInTime;
      if (data.checkOutTime !== undefined) payload.checkout_time = data.checkOutTime;
      if (data.status !== undefined) payload.status = data.status;
      if (data.photo !== undefined) payload.photo_url = data.photo;
      if (data.propertyId !== undefined) payload.property_id = data.propertyId;
      // TODO: the following columns do not exist on visitor_logs
      // if (data.email !== undefined) payload.email = data.email;
      // if (data.purpose !== undefined) payload.purpose = data.purpose;
      // if (data.hostId !== undefined) payload.host_id = data.hostId;
      // if (data.expectedTime !== undefined) { ... }
      // if (data.idProof !== undefined) payload.id_proof_url = data.idProof;
      // if (data.passCode !== undefined) payload.pass_code = data.passCode;
      // if (data.vehicleNumber !== undefined) payload.vehicle_number = data.vehicleNumber;
      // if (data.belongings !== undefined) payload.belongings = data.belongings;
      // if (data.preRegistered !== undefined) payload.pre_registered = data.preRegistered;

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
        name: data.visitorName, // mapped from visitor_name -> name
        mobile: data.mobile,
        whom_to_meet: data.whomToMeet,
        property_id: data.propertyId,
        status: 'checked_in',
        checkin_time: now,
        // TODO: purpose and pre_registered do not exist on visitor_logs
        // purpose: data.purpose,
        // pre_registered: false,
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
