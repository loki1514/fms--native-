'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface Ticket {
  id: string;
  ticket_number?: string;
  title?: string;
  description?: string;
  status: string;
  priority: string;
  created_at: string;
  raised_by?: string;
  assigned_to?: string;
  assignee?: { full_name?: string; user_photo_url?: string };
}

export function useTenantTickets(propertyId: string | undefined, userId: string | undefined) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchTickets = useCallback(async () => {
    if (!propertyId) {
      console.log('[useTenantTickets] No propertyId — skipping fetch');
      setLoading(false);
      return;
    }

    console.log('[useTenantTickets] Fetching for propertyId:', propertyId, 'userId:', userId);
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('tickets')
      .select(`
        id,
        ticket_number,
        title,
        description,
        status,
        priority,
        created_at,
        raised_by,
        assigned_to,
        assignee:users!assigned_to(full_name, user_photo_url)
      `)
      .eq('property_id', propertyId)
      .eq('internal', false)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setTickets((data as Ticket[]) ?? []);
    }

    setLoading(false);
  }, [propertyId, supabase]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Real-time subscription
  useEffect(() => {
    if (!propertyId) return;

    const channel = supabase
      .channel(`tenant_tickets_${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `property_id=eq.${propertyId}`,
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId, supabase, fetchTickets]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => !['resolved', 'closed'].includes(t.status?.toLowerCase())).length;
    const total = tickets.length;
    const critical = tickets.filter((t) => t.priority?.toLowerCase() === 'critical' && t.status !== 'resolved' && t.status !== 'closed').length;
    const completed = tickets.filter((t) => ['resolved', 'closed'].includes(t.status?.toLowerCase())).length;
    const completion = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { open, total, critical, completion };
  }, [tickets]);

  return { tickets, loading, error, stats, refetch: fetchTickets };
}
