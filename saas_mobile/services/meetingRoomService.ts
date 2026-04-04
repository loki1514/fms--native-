import { supabase } from '@/utils/supabase';
import { ApiResponse } from './api/client';
import type { MeetingRoom, RoomBooking } from '@/types';

const mapRoomFromDb = (row: Record<string, unknown>): MeetingRoom => ({
  id: row.id as string,
  propertyId: row.property_id as string,
  name: row.name as string,
  location: row.location as string,
  capacity: row.capacity as number,
  size: row.size as number,
  status: (row.status ?? 'available') as 'available' | 'maintenance' | 'inactive',
  images: row.photo_url ? [row.photo_url as string] : [],
  amenities: (row.amenities as string[]) || [],
  createdAt: (row.created_at as string) || '',
  updatedAt: (row.updated_at as string) || '',
});

const mapBookingFromDb = (row: Record<string, unknown>): RoomBooking => ({
  id: row.id as string,
  roomId: row.room_id as string,
  organizerId: row.user_id as string,
  title: row.title as string,
  attendees: (row.attendees as string[]) || [],
  startTime: row.start_time as string,
  endTime: row.end_time as string,
  status: row.status as 'confirmed' | 'cancelled' | 'completed',
  creditsUsed: row.credits_used as number,
  notes: (row.notes as string | null) ?? undefined,
  createdAt: row.created_at as string,
});

export const meetingRoomService = {
  async getMeetingRooms(filters?: {
    propertyId?: string;
    search?: string;
    status?: string;
  }): Promise<ApiResponse<MeetingRoom[]>> {
    try {
      let query = (supabase
        .from('meeting_rooms')
        .select('*')
        .order('name', { ascending: true }) as any);

      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data: (data || []).map(mapRoomFromDb), error: null };
    } catch (err) {
      return { data: [], error: err as Error };
    }
  },

  async getMeetingRoom(id: string): Promise<ApiResponse<MeetingRoom>> {
    try {
      const { data, error }: any = await (supabase
        .from('meeting_rooms')
        .select('*')
        .eq('id', id)
        .single());

      if (error) throw error;
      return { data: data ? mapRoomFromDb(data) : null, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  async createMeetingRoom(data: Partial<MeetingRoom>): Promise<ApiResponse<MeetingRoom>> {
    try {
      const payload: Record<string, unknown> = {
        property_id: data.propertyId,
        name: data.name,
        location: data.location,
        capacity: data.capacity,
        size: data.size,
        status: data.status,
        amenities: data.amenities,
      };

      if (data.images && data.images.length > 0) {
        payload.photo_url = data.images[0];
      }

      const { data: row, error }: any = await (supabase as any)
        .from('meeting_rooms')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return { data: row ? mapRoomFromDb(row) : null, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  async updateMeetingRoom(id: string, data: Partial<MeetingRoom>): Promise<ApiResponse<MeetingRoom>> {
    try {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (data.propertyId !== undefined) payload.property_id = data.propertyId;
      if (data.name !== undefined) payload.name = data.name;
      if (data.location !== undefined) payload.location = data.location;
      if (data.capacity !== undefined) payload.capacity = data.capacity;
      if (data.size !== undefined) payload.size = data.size;
      if (data.status !== undefined) payload.status = data.status;
      if (data.amenities !== undefined) payload.amenities = data.amenities;
      if (data.images !== undefined) payload.photo_url = data.images[0] ?? null;

      const { data: row, error }: any = await (supabase as any)
        .from('meeting_rooms')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data: row ? mapRoomFromDb(row) : null, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  async deleteMeetingRoom(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await (supabase
        .from('meeting_rooms')
        .delete() as any)
        .eq('id', id);

      if (error) throw error;
      return { data: undefined, error: null };
    } catch (err) {
      return { data: undefined, error: err as Error };
    }
  },

  async getBookings(
    roomId?: string,
    filters?: { date?: string; userId?: string }
  ): Promise<ApiResponse<RoomBooking[]>> {
    try {
      let query = (supabase
        .from('meeting_room_bookings')
        .select('*')
        .order('start_time', { ascending: true }) as any);

      if (roomId) {
        query = query.eq('room_id', roomId);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.date) {
        const dayStart = `${filters.date}T00:00:00`;
        const dayEnd = `${filters.date}T23:59:59`;
        query = query.gte('start_time', dayStart).lte('start_time', dayEnd);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data: (data || []).map(mapBookingFromDb), error: null };
    } catch (err) {
      return { data: [], error: err as Error };
    }
  },

  async createBooking(data: Partial<RoomBooking>): Promise<ApiResponse<RoomBooking>> {
    try {
      const payload: Record<string, unknown> = {
        room_id: data.roomId,
        user_id: data.organizerId,
        title: data.title,
        attendees: data.attendees,
        start_time: data.startTime,
        end_time: data.endTime,
        status: data.status ?? 'confirmed',
        credits_used: data.creditsUsed,
        notes: data.notes,
      };

      const { data: row, error }: any = await (supabase as any)
        .from('meeting_room_bookings')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return { data: row ? mapBookingFromDb(row) : null, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  async cancelBooking(id: string): Promise<ApiResponse<RoomBooking>> {
    try {
      const { data: existing, error: fetchError }: any = await (supabase
        .from('meeting_room_bookings')
        .select('*')
        .eq('id', id)
        .single());

      if (fetchError) throw fetchError;

      const { data: row, error }: any = await (supabase as any)
        .from('meeting_room_bookings')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data: row ? mapBookingFromDb(row) : null, error: null };
    } catch (err) {
      return { data: null, error: err as Error };
    }
  },

  async checkAvailability(
    roomId: string,
    startTime: string,
    endTime: string
  ): Promise<ApiResponse<boolean>> {
    try {
      const { data, error }: any = await (supabase
        .from('meeting_room_bookings')
        .select('id')
        .eq('room_id', roomId)
        .eq('status', 'confirmed')
        .lt('start_time', endTime)
        .gt('end_time', startTime)) as any;

      if (error) throw error;
      return { data: (data || []).length === 0, error: null };
    } catch (err) {
      return { data: true, error: err as Error };
    }
  },
};
