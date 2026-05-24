/**
 * Retrieval Layer (RAG) — fetches relevant context for the voice agent.
 * Fetches: recent tickets, property info, user bookings.
 */

import { supabase } from '@/utils/supabase/client';

export interface RetrievalResult {
  recentTickets: TicketEntry[];
  propertyInfo: PropertyEntry | null;
  recentBookings: BookingEntry[];
}

export interface TicketEntry {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
}

export interface PropertyEntry {
  name: string;
  address: string;
  open_tickets: number;
  total_tickets: number;
}

export interface BookingEntry {
  id: string;
  room_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

export async function retrieveContext(
  propertyId: string,
  userId: string,
  query: string,
  options: { topTickets?: number } = {}
): Promise<RetrievalResult> {
  const { topTickets = 5 } = options;

  const [ticketsResult, propertyResult, bookingsResult] = await Promise.all([
    fetchRecentTickets(propertyId, topTickets),
    fetchPropertyInfo(propertyId),
    fetchRecentBookings(propertyId, userId, 3),
  ]);

  return {
    recentTickets: ticketsResult,
    propertyInfo: propertyResult,
    recentBookings: bookingsResult,
  };
}

async function fetchRecentTickets(propertyId: string, limit: number): Promise<TicketEntry[]> {
  const { data, error } = await (supabase.from('tickets') as any)
    .select('id, ticket_number, title, status, priority, created_at')
    .eq('property_id', propertyId)
    .eq('is_internal', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as TicketEntry[];
}

async function fetchPropertyInfo(propertyId: string): Promise<PropertyEntry | null> {
  const { data, error } = await (supabase.from('properties') as any)
    .select('name, address')
    .eq('id', propertyId)
    .single();

  if (error) return null;

  const d = data as { name: string; address?: string };

  const [{ count: open }, { count: total }] = await Promise.all([
    (supabase.from('tickets') as any).select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_internal', false)
      .not('status', 'in', '(resolved,closed)'),
    (supabase.from('tickets') as any).select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId).eq('is_internal', false),
  ]);

  return {
    name: d.name,
    address: d.address ?? '',
    open_tickets: open ?? 0,
    total_tickets: total ?? 0,
  };
}

async function fetchRecentBookings(propertyId: string, userId: string, limit: number): Promise<BookingEntry[]> {
  const { data, error } = await (supabase.from('meeting_room_bookings') as any)
    .select('id, booking_date, start_time, end_time, status, meeting_room:meeting_rooms(name)')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .order('booking_date', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return (data as any[]).map((b: any) => ({
    id: b.id,
    room_name: b.meeting_room?.name ?? 'Unknown Room',
    booking_date: b.booking_date,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
  }));
}

export function formatRetrievalContext(retrieval: RetrievalResult): string {
  const parts: string[] = [];

  if (retrieval.propertyInfo) {
    const p = retrieval.propertyInfo;
    parts.push(`PROPERTY: ${p.name}${p.address ? ` (${p.address})` : ''} — ${p.open_tickets} open tickets out of ${p.total_tickets} total`);
  }

  if (retrieval.recentTickets.length > 0) {
    const tickets = retrieval.recentTickets
      .map(t => `  - ${t.ticket_number}: "${t.title}" [${t.status}]`)
      .join('\n');
    parts.push(`RECENT TICKETS:\n${tickets}`);
  }

  if (retrieval.recentBookings.length > 0) {
    const bookings = retrieval.recentBookings
      .map(b => `  - ${b.room_name} on ${b.booking_date} ${b.start_time}-${b.end_time} [${b.status}]`)
      .join('\n');
    parts.push(`YOUR RECENT BOOKINGS:\n${bookings}`);
  }

  return parts.length > 0 ? `\n\nCONTEXT:\n${parts.join('\n\n')}` : '';
}
