import { serverApi } from '@/lib/serverApi';
import { ApiResponse } from './api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StockItem {
  id: string;
  property_id: string;
  organization_id?: string;
  name: string;
  item_code: string;
  description: string | null;
  category: string | null;
  quantity: number;
  unit: string | null;
  min_threshold: number;
  per_unit_cost: number;
  location: string | null;
  barcode: string | null;
  barcode_format: string | null;
  qr_code_data: any;
  barcode_generated_at: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  item_id: string;
  property_id: string;
  action: 'add' | 'remove' | 'adjust' | 'initial';
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  stock_items?: { name: string; item_code: string; unit?: string } | null;
  users?: { full_name: string } | null;
}

export interface StockReport {
  id: string;
  property_id: string;
  report_date: string;
  total_items: number;
  low_stock_count: number;
  total_added: number;
  total_removed: number;
  report_data: any;
  generated_by: string | null;
  generated_at: string;
}

export interface BarcodeDetails {
  barcode: string;
  barcode_format: string;
  qr_code_data: any;
  item_name: string;
  item_code: string;
}

// ---------------------------------------------------------------------------
// Stock Service — routes through saas_mobile_server
// Aligned with saas_one web app stock module
// ---------------------------------------------------------------------------

export const stockService = {
  // ── Get Stock Items ───────────────────────────────────────────────────────
  async getStockItems(filters?: {
    propertyId?: string;
    search?: string;
    category?: string;
    lowStockOnly?: boolean;
    barcode?: string;
  }): Promise<ApiResponse<StockItem[]>> {
    try {
      const params = new URLSearchParams();
      if (filters?.propertyId) params.append('propertyId', filters.propertyId);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.lowStockOnly) params.append('lowStockOnly', 'true');
      if (filters?.barcode) params.append('barcode', filters.barcode);

      const res = await serverApi.get<any>(`/api/stock/items?${params.toString()}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stock items');
      return { success: true, data: res.data?.items ?? [] };
    } catch (err: any) {
      console.error('[Stock] getStockItems error:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  // ── Get Single Stock Item ─────────────────────────────────────────────────
  async getStockItem(id: string, propertyId?: string): Promise<ApiResponse<StockItem>> {
    try {
      const params = propertyId ? `?propertyId=${propertyId}` : '';
      const res = await serverApi.get<any>(`/api/stock/items/${id}${params}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stock item');
      return { success: true, data: res.data?.item ?? null };
    } catch (err: any) {
      console.error('[Stock] getStockItem error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Create Stock Item ─────────────────────────────────────────────────────
  async createStockItem(data: {
    propertyId: string;
    name: string;
    item_code?: string;
    description?: string;
    category?: string;
    quantity?: number;
    unit?: string;
    min_threshold?: number;
    per_unit_cost?: number;
    location?: string;
  }): Promise<ApiResponse<StockItem>> {
    try {
      const res = await serverApi.post<any>('/api/stock/items', {
        propertyId: data.propertyId,
        name: data.name,
        item_code: data.item_code,
        description: data.description,
        category: data.category,
        quantity: data.quantity ?? 0,
        unit: data.unit,
        min_threshold: data.min_threshold ?? 10,
        per_unit_cost: data.per_unit_cost ?? 0,
        location: data.location,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to create stock item');
      return { success: true, data: res.data?.item };
    } catch (err: any) {
      console.error('[Stock] createStockItem error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Update Stock Item ─────────────────────────────────────────────────────
  async updateStockItem(id: string, data: Partial<StockItem>): Promise<ApiResponse<StockItem>> {
    try {
      const payload: any = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.item_code !== undefined) payload.item_code = data.item_code;
      if (data.description !== undefined) payload.description = data.description;
      if (data.category !== undefined) payload.category = data.category;
      if (data.quantity !== undefined) payload.quantity = data.quantity;
      if (data.unit !== undefined) payload.unit = data.unit;
      if (data.min_threshold !== undefined) payload.min_threshold = data.min_threshold;
      if (data.per_unit_cost !== undefined) payload.per_unit_cost = data.per_unit_cost;
      if (data.location !== undefined) payload.location = data.location;
      if (data.barcode !== undefined) payload.barcode = data.barcode;

      const res = await serverApi.patch<any>(`/api/stock/items/${id}`, payload);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to update stock item');
      return { success: true, data: res.data?.item };
    } catch (err: any) {
      console.error('[Stock] updateStockItem error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Delete Single Stock Item ──────────────────────────────────────────────
  async deleteStockItem(id: string, propertyId?: string): Promise<ApiResponse<void>> {
    try {
      const params = propertyId ? `?propertyId=${propertyId}` : '';
      const res = await serverApi.delete<any>(`/api/stock/items/${id}${params}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to delete stock item');
      return { success: true, data: undefined };
    } catch (err: any) {
      console.error('[Stock] deleteStockItem error:', err);
      return { success: false, data: null as unknown as void, error: err.message };
    }
  },

  // ── Bulk Delete Stock Items ───────────────────────────────────────────────
  async bulkDeleteStockItems(propertyId: string, itemIds: string[]): Promise<ApiResponse<{ deletedCount: number }>> {
    try {
      const res = await serverApi.delete<any>('/api/stock/items', {
        propertyId,
        itemIds,
      } as any);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to delete stock items');
      return { success: true, data: { deletedCount: res.data?.deletedCount ?? 0 } };
    } catch (err: any) {
      console.error('[Stock] bulkDeleteStockItems error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Get Stock Movements ───────────────────────────────────────────────────
  async getStockMovements(propertyId: string, filters?: { itemId?: string; limit?: number }): Promise<ApiResponse<StockMovement[]>> {
    try {
      const params = new URLSearchParams({ propertyId });
      if (filters?.itemId) params.append('itemId', filters.itemId);
      if (filters?.limit) params.append('limit', String(filters.limit));

      const res = await serverApi.get<any>(`/api/stock/movements?${params.toString()}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stock movements');
      return { success: true, data: res.data?.movements ?? [] };
    } catch (err: any) {
      console.error('[Stock] getStockMovements error:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  // ── Record Stock Movement ─────────────────────────────────────────────────
  async recordMovement(data: {
    propertyId: string;
    itemId: string;
    action: 'add' | 'remove' | 'adjust' | 'in' | 'out';
    quantity: number;
    notes?: string;
  }): Promise<ApiResponse<{ movement: StockMovement; item: StockItem }>> {
    try {
      const res = await serverApi.post<any>('/api/stock/movements', {
        propertyId: data.propertyId,
        itemId: data.itemId,
        action: data.action,
        quantity: data.quantity,
        notes: data.notes,
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to record movement');
      return { success: true, data: res.data };
    } catch (err: any) {
      console.error('[Stock] recordMovement error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Scan Item (lookup by barcode + record movement) ───────────────────────
  async scanItem(data: {
    propertyId: string;
    itemId: string;
    action: 'in' | 'out' | 'add' | 'remove' | 'adjust';
    quantity: number;
    notes?: string;
  }): Promise<ApiResponse<{ movement: StockMovement; newQuantity: number; item_name: string }>> {
    try {
      const res = await serverApi.post<any>('/api/stock/scan', {
        propertyId: data.propertyId,
        itemId: data.itemId,
        action: data.action,
        quantity: data.quantity,
        notes: data.notes ?? 'Scanned via Mobile',
      });
      if (res.error) throw new Error(res.error?.message ?? 'Scan failed');
      return { success: true, data: res.data };
    } catch (err: any) {
      console.error('[Stock] scanItem error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Get Stock Item by Barcode ─────────────────────────────────────────────
  async getStockByBarcode(barcode: string, propertyId: string): Promise<ApiResponse<StockItem>> {
    try {
      const res = await serverApi.get<any>(`/api/stock/items/by-barcode?code=${encodeURIComponent(barcode)}&propertyId=${propertyId}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch by barcode');
      return { success: true, data: res.data?.item ?? null };
    } catch (err: any) {
      console.error('[Stock] getStockByBarcode error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Get Barcode Details ───────────────────────────────────────────────────
  async getBarcodeDetails(itemId: string): Promise<ApiResponse<BarcodeDetails>> {
    try {
      const res = await serverApi.get<any>(`/api/stock/items/${itemId}/barcode`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch barcode');
      return { success: true, data: res.data };
    } catch (err: any) {
      console.error('[Stock] getBarcodeDetails error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Regenerate Barcode ────────────────────────────────────────────────────
  async regenerateBarcode(itemId: string): Promise<ApiResponse<BarcodeDetails>> {
    try {
      const res = await serverApi.post<any>(`/api/stock/items/${itemId}/barcode`, {});
      if (res.error) throw new Error(res.error?.message ?? 'Failed to regenerate barcode');
      return { success: true, data: res.data };
    } catch (err: any) {
      console.error('[Stock] regenerateBarcode error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },

  // ── Get Stock Reports ─────────────────────────────────────────────────────
  async getReports(propertyId: string, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<ApiResponse<StockReport[]>> {
    try {
      const params = new URLSearchParams({ propertyId });
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.limit) params.append('limit', String(filters.limit));

      const res = await serverApi.get<any>(`/api/stock/reports?${params.toString()}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch reports');
      return { success: true, data: res.data?.reports ?? [] };
    } catch (err: any) {
      console.error('[Stock] getReports error:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  // ── Generate Stock Report ─────────────────────────────────────────────────
  async generateReport(propertyId: string, reportDate: string): Promise<ApiResponse<StockReport>> {
    try {
      const res = await serverApi.post<any>('/api/stock/reports', {
        propertyId,
        reportDate,
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to generate report');
      return { success: true, data: res.data?.report };
    } catch (err: any) {
      console.error('[Stock] generateReport error:', err);
      return { success: false, data: null as any, error: err.message };
    }
  },
};

export default stockService;
