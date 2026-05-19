import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface OrgData {
  orgName: string;
  properties: any[];
  tickets: any[];
  sopCount: number;
  sopTotal: number;
  energyKwh: number;
  vmsStats: { total: number; in: number; out: number };
  vendorStats: { revenue: number; commission: number };
  healthScore: number;
  attentionItems: any[];
}

export default function useOrgData(orgId: string) {
  const [data, setData] = useState<OrgData>({
    orgName: 'Organization',
    properties: [],
    tickets: [],
    sopCount: 0,
    sopTotal: 0,
    energyKwh: 0,
    vmsStats: { total: 0, in: 0, out: 0 },
    vendorStats: { revenue: 0, commission: 0 },
    healthScore: 100,
    attentionItems: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrgData = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    const supabase = createClient();

    try {
      // 1. Fetch organization details
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single();
      
      const orgName = orgData?.name || 'Organization';

      // 2. Fetch all properties belonging to this organization
      const { data: properties } = await supabase
        .from('properties')
        .select('*')
        .eq('organization_id', orgId);

      const propertyList = properties || [];
      const propIds = propertyList.map((p) => p.id);

      if (propIds.length === 0) {
        setData({
          orgName,
          properties: [],
          tickets: [],
          sopCount: 0,
          sopTotal: 0,
          energyKwh: 0,
          vmsStats: { total: 0, in: 0, out: 0 },
          vendorStats: { revenue: 0, commission: 0 },
          healthScore: 100,
          attentionItems: [],
        });
        setIsLoading(false);
        return;
      }

      // 3. Fetch tickets across all properties
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*')
        .in('property_id', propIds);
      const tickets = ticketsData || [];

      // 4. Fetch SOP completions across all properties
      const { data: sopData } = await supabase
        .from('sop_completions')
        .select('status')
        .in('property_id', propIds);
      
      let sopTotal = 0;
      let sopCount = 0;
      if (sopData) {
        sopTotal = sopData.length;
        sopCount = sopData.filter((s: any) => s.status === 'completed').length;
      }

      // 5. Fetch energy readings (latest reading for each property, then sum)
      let energyKwh = 0;
      for (const propId of propIds) {
        const { data: elecData } = await supabase
          .from('electricity_readings')
          .select('final_units')
          .eq('property_id', propId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (elecData) {
          energyKwh += Math.round((elecData as any).final_units || 0);
        }
      }

      // 6. Fetch visitor logs
      const { data: vmsData } = await supabase
        .from('visitor_logs')
        .select('status')
        .in('property_id', propIds);
      
      let vmsStats = { total: 0, in: 0, out: 0 };
      if (vmsData) {
        const total = vmsData.length;
        const checkedIn = vmsData.filter((v: any) => v.status === 'checked_in').length;
        const checkedOut = vmsData.filter((v: any) => v.status === 'checked_out').length;
        vmsStats = { total, in: checkedIn, out: checkedOut };
      }

      // 7. Fetch Cafeteria revenue
      const { data: revData } = await supabase
        .from('vendor_daily_revenue')
        .select('revenue_amount')
        .in('property_id', propIds);
      
      let vendorStats = { revenue: 0, commission: 0 };
      if (revData) {
        const totalRev = revData.reduce((acc, row) => acc + (row.revenue_amount || 0), 0);
        vendorStats = { revenue: totalRev, commission: totalRev * 0.1 };
      }

      // 8. Fetch health scores for each property and average them
      let totalHealthScore = 0;
      let validScoresCount = 0;
      for (const propId of propIds) {
        try {
          const { data: healthData } = await supabase.rpc('get_property_health_score', {
            p_property_id: propId,
          });
          if (healthData && typeof healthData === 'number') {
            totalHealthScore += healthData;
            validScoresCount++;
          }
        } catch (_) {}
      }
      const healthScore = validScoresCount > 0 ? Math.round(totalHealthScore / validScoresCount) : 100;

      // 9. Fetch attention items across all properties
      let attentionItems: any[] = [];
      for (const propId of propIds) {
        try {
          const { data: attentionData } = await supabase.rpc('get_attention_items', {
            p_property_id: propId,
            p_limit: 3,
          });
          if (attentionData && Array.isArray(attentionData)) {
            attentionItems = [...attentionItems, ...attentionData];
          }
        } catch (_) {}
      }

      setData({
        orgName,
        properties: propertyList,
        tickets,
        sopCount,
        sopTotal,
        energyKwh,
        vmsStats,
        vendorStats,
        healthScore,
        attentionItems: attentionItems.slice(0, 10), // cap at 10 items
      });
      setError(null);
    } catch (err) {
      console.error('[useOrgData] fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch org data');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchOrgData();
  }, [fetchOrgData]);

  return { data, isLoading, error, refetch: fetchOrgData };
}
