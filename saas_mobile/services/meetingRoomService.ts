import { serverApi } from '@/lib/serverApi';

// ---------------------------------------------------------------------------
// Types (aligned with mobileApi.ts for drop-in replacement)
// ---------------------------------------------------------------------------

export interface MeetingRoom {
  id: string;
  property_id: string;
  name: string;
  photo_url?: string;
  location?: string;
  capacity: number;
  size?: number;
  amenities?: string[];
  status: string;
  created_by?: string;
  created_at: string;
}

export interface MeetingRoomBooking {
  id: string;
  meeting_room_id: string;
  property_id: string;
  user_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  company_id?: string;
  organization_id?: string;
  created_at: string;
  meeting_room?: { name: string; photo_url?: string; location?: string };
  tenant?: { full_name: string; email: string };
}

export interface MeetingRoomCredit {
  id: string;
  property_id: string;
  user_id?: string;
  company_id?: string;
  assigned_by?: string;
  monthly_hours: number;
  remaining_hours: number;
  last_reset_at: string;
  next_reset_at: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Meeting Room Service — routes ALL data through saas_mobile_server
// ---------------------------------------------------------------------------

export async function getMeetingRooms(propertyId: string, status?: string): Promise<{ rooms?: MeetingRoom[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.append('propertyId', propertyId);
    if (status) params.append('status', status);

    const res = await serverApi.get<any>(`/api/meeting-rooms?${params.toString()}`);
    if (res.error) throw new Error(res.error.message ?? 'Failed to fetch rooms');
    return { rooms: res.data?.rooms ?? [] };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function getMeetingRoomBookings(propertyId: string, status?: string): Promise<{ bookings?: MeetingRoomBooking[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.append('propertyId', propertyId);
    if (status) params.append('status', status);

    const res = await serverApi.get<any>(`/api/meeting-room-bookings?${params.toString()}`);
    if (res.error) throw new Error(res.error.message ?? 'Failed to fetch bookings');
    return { bookings: res.data?.bookings ?? [] };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function getMeetingRoomCredits(propertyId: string): Promise<{ credit?: MeetingRoomCredit | null; company?: any | null; error?: string }> {
  try {
    const res = await serverApi.get<any>(`/api/meeting-room-credits?propertyId=${propertyId}`);
    if (res.error) throw new Error(res.error.message ?? 'Failed to fetch credits');
    return { credit: res.data?.credit ?? null, company: res.data?.company ?? null };
  } catch (err: any) {
    return { error: err.message };
  }
}

export interface CreateBookingInput {
  meetingRoomId: string;
  propertyId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export async function createMeetingRoomBooking(input: CreateBookingInput): Promise<{ success?: boolean; booking?: MeetingRoomBooking; error?: string }> {
  try {
    const res = await serverApi.post<any>('/api/meeting-room-bookings', input);
    if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to create booking');
    return { success: true, booking: res.data?.booking as MeetingRoomBooking };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function cancelMeetingRoomBookingApi(bookingId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const res = await serverApi.patch<any>(`/api/meeting-room-bookings/${bookingId}`, { status: 'cancelled' });
    if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to cancel booking');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export interface CreateMeetingRoomInput {
  name: string;
  propertyId: string;
  location?: string;
  capacity: number;
  size?: number;
  amenities?: string[];
  photo_url?: string;
  status?: string;
}

export async function createMeetingRoomApi(input: CreateMeetingRoomInput): Promise<{ success?: boolean; room?: MeetingRoom; error?: string }> {
  try {
    const res = await serverApi.post<any>('/api/meeting-rooms', input);
    if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to create room');
    return { success: true, room: res.data?.room as MeetingRoom };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateMeetingRoomApi(id: string, input: Partial<CreateMeetingRoomInput>): Promise<{ success?: boolean; room?: MeetingRoom; error?: string }> {
  try {
    const res = await serverApi.patch<any>(`/api/meeting-rooms/${id}`, input);
    if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to update room');
    return { success: true, room: res.data?.room as MeetingRoom };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function deleteMeetingRoomApi(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const res = await serverApi.delete<any>(`/api/meeting-rooms/${id}`);
    if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to deactivate room');
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function uploadMeetingRoomPhoto(photoUri: string): Promise<{ success?: boolean; url?: string; error?: string }> {
  try {
    const filename = photoUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1] : 'jpg';
    const type = `image/${ext}`;

    const fileRes = await fetch(photoUri);
    const blob = await fileRes.blob();

    const res = await serverApi.upload('meeting-rooms', `${Date.now()}.${ext}`, blob, type);
    if (res.error) throw new Error(res.error?.message ?? 'Upload failed');

    const urlRes = await serverApi.getPublicUrl('meeting-rooms', res.data!.path);
    if (urlRes.error) throw new Error(urlRes.error?.message ?? 'Failed to get public URL');

    return { success: true, url: urlRes.data?.publicUrl ?? '' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Additional admin helpers
// ---------------------------------------------------------------------------

export async function updateMeetingRoomCreditsApi(payload: any): Promise<{ success?: boolean; credit?: any; error?: string }> {
  try {
    const res = await serverApi.post<any>('/api/meeting-room-credits', payload);
    if (res.error) throw new Error(res.error?.message ?? 'Failed to update credits');
    return { success: true, credit: res.data?.credit };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function getCompaniesWithCreditsApi(propertyId: string): Promise<{ companies?: any[]; error?: string }> {
  try {
    const res = await serverApi.get<any>(`/api/companies?propertyId=${propertyId}`);
    if (res.error) throw new Error(res.error.message ?? 'Failed to fetch companies');
    return { companies: res.data?.companies ?? [] };
  } catch (err: any) {
    return { error: err.message };
  }
}
