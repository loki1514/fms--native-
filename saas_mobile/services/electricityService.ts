// electricityService.ts – uses the mobile‑server API client instead of direct Supabase calls
// ---------------------------------------------------------------------------
// Types (aligned with saas_one schema)
// ---------------------------------------------------------------------------

export interface ElectricityMeter {
  id: string;
  property_id: string;
  name: string;
  meter_number?: string | null;
  meter_type: 'main' | 'generator' | 'solar' | 'sub';
  max_load_kw?: number | null;
  status?: string | null;
  last_reading?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ElectricityReading {
  id: string;
  property_id: string;
  meter_id: string;
  reading_date: string;
  opening_reading: number;
  closing_reading: number;
  computed_units?: number | null;
  final_units?: number | null;
  computed_cost?: number | null;
  multiplier_id?: string | null;
  multiplier_value_used?: number | null;
  tariff_id?: string | null;
  tariff_rate_used?: number | null;
  peak_load_kw?: number | null;
  notes?: string | null;
  alert_status?: string | null;
  photo_url?: string | null;
  ocr_reading?: number | null;
  ocr_confidence?: number | null;
  ocr_status?: string | null;
  created_by?: string | null;
  created_at?: string;
  meter?: ElectricityMeter;
}

export interface GridTariff {
  id: string;
  property_id: string;
  utility_provider?: string | null;
  rate_per_unit: number;
  unit_type?: string | null;
  effective_from: string;
  effective_to?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface MeterMultiplier {
  id: string;
  meter_id: string;
  ct_ratio_primary?: number | null;
  ct_ratio_secondary?: number | null;
  pt_ratio_primary?: number | null;
  pt_ratio_secondary?: number | null;
  meter_constant?: number | null;
  multiplier_value?: number | null;
  effective_from: string;
  effective_to?: string | null;
  reason?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface ReadingPayload {
  meter_id: string;
  reading_date: string;
  opening_reading: number;
  closing_reading: number;
  notes?: string | null;
  photo_url?: string | null;
  created_by?: string | null;
}

// ---------------------------------------------------------------------------
// Electricity Service – all operations go through the mobile server API client
// ---------------------------------------------------------------------------

import { apiClient } from '@/services/api/client';
import { serverApi } from '@/lib/serverApi';

export const electricityService = {
  // ── Fetch Meters ──────────────────────────────────────────────────────────
  async fetchMeters(propertyId: string) {
    const res = await serverApi.get<any>(`/api/electricity/meters?propertyId=${propertyId}`);
    return { success: !res.error, data: res.data?.meters || [], error: res.error };
  },

  // ── Create Meter ──────────────────────────────────────────────────────────
  async createMeter(payload: Partial<ElectricityMeter> & { initial_multiplier?: Partial<MeterMultiplier> }) {
    const res = await serverApi.post<any>('/api/electricity/meters', payload);
    return { success: !res.error, data: res.data?.meter, error: res.error };
  },

  // ── Delete Meter ──────────────────────────────────────────────────────────
  async deleteMeter(meterId: string) {
    const res = await serverApi.delete<any>(`/api/electricity/meters/${meterId}`);
    return { success: !res.error, data: res.data, error: res.error };
  },

  // ── Fetch Readings ────────────────────────────────────────────────────────
  async fetchReadings(propertyId: string, filters?: { meterId?: string; fromDate?: string; toDate?: string }) {
    const params = new URLSearchParams({ propertyId });
    if (filters?.meterId) params.append('meterId', filters.meterId);
    if (filters?.fromDate) params.append('fromDate', filters.fromDate);
    if (filters?.toDate) params.append('toDate', filters.toDate);

    const res = await serverApi.get<any>(`/api/electricity/readings?${params.toString()}`);
    return { success: !res.error, data: res.data?.readings || [], error: res.error };
  },

  // ── Submit Reading (with cost computation) ────────────────────────────────
  async submitReading(propertyId: string, payload: ReadingPayload) {
    const res = await serverApi.post<any>('/api/electricity/readings', {
      propertyId,
      ...payload,
    });
    return { success: !res.error, data: res.data?.reading, error: res.error };
  },

  // ── Delete Reading ────────────────────────────────────────────────────────
  async deleteReading(readingId: string, meterId: string, propertyId: string) {
    const res = await serverApi.delete<any>(`/api/electricity/readings/${readingId}?propertyId=${propertyId}`);
    return { success: !res.error, data: res.data, error: res.error };
  },

  // ── Fetch Grid Tariffs ────────────────────────────────────────────────────
  async fetchTariffs(propertyId: string) {
    const res = await apiClient.get<GridTariff[]>('grid_tariffs', {
      filters: { property_id: propertyId },
      order: { column: 'effective_from', ascending: false },
    });
    return res;
  },

  // ── Create Tariff (closes previous active) ────────────────────────────────
  async createTariff(payload: Partial<GridTariff>) {
    // Close any existing active tariff for the same property
    if (payload.property_id && payload.effective_from) {
      const prevDate = new Date(payload.effective_from);
      prevDate.setDate(prevDate.getDate() - 1);
      await apiClient.put<any>('grid_tariffs', '', {
        effective_to: prevDate.toISOString().split('T')[0],
        property_id: payload.property_id,
        effective_to_null: true, // custom flag handled server‑side to target rows where effective_to IS NULL
      });
    }
    // Insert the new tariff
    return await apiClient.post<GridTariff>('grid_tariffs', payload);
  },

  // ── Delete Tariff ─────────────────────────────────────────────────────────
  async deleteTariff(tariffId: string, propertyId: string) {
    const delRes = await apiClient.delete<boolean>('grid_tariffs', tariffId);
    if (!delRes.success) return delRes;

    // Re‑open the most recent previous tariff
    const prevRes = await apiClient.get<GridTariff[]>('grid_tariffs', {
      filters: { property_id: propertyId },
      order: { column: 'effective_from', ascending: false },
      limit: 1,
      single: true,
    });
    const prev = prevRes.success && prevRes.data ? prevRes.data : null;
    if (prev?.id) {
      await apiClient.put<any>('grid_tariffs', prev.id, { effective_to: null });
    }
    return delRes;
  },

  // ── Fetch Meter Multipliers ───────────────────────────────────────────────
  async fetchMultipliers(meterId: string) {
    return await apiClient.get<MeterMultiplier[]>('meter_multipliers', {
      filters: { meter_id: meterId },
      order: { column: 'effective_from', ascending: false },
    });
  },

  // ── Create Multiplier (closes previous active) ────────────────────────────
  async createMultiplier(payload: Partial<MeterMultiplier>) {
    if (payload.meter_id && payload.effective_from) {
      const prevDate = new Date(payload.effective_from);
      prevDate.setDate(prevDate.getDate() - 1);
      await apiClient.put<any>('meter_multipliers', '', {
        effective_to: prevDate.toISOString().split('T')[0],
        meter_id: payload.meter_id,
        effective_to_null: true,
      });
    }
    return await apiClient.post<MeterMultiplier>('meter_multipliers', payload);
  },
};
