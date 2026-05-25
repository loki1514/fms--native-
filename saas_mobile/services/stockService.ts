import { serverApi } from '@/lib/serverApi';
import { apiClient, ApiResponse } from './api/client';
import type { InventoryItem, StockTransaction } from '@/types';

interface StockItemsRow {
  id: string;
  property_id: string;
  name: string;
  item_code: string;
  description: string | null;
  category: string | null;
  quantity: number;
  unit: string | null;
  min_threshold: number | null;
  location: string | null;
  barcode: string | null;
  created_at: string;
  updated_at: string;
}

interface StockMovementsRow {
  id: string;
  item_id: string;
  action: 'add' | 'remove' | 'adjust' | 'initial';
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  user_id: string | null;
  created_at: string;
}

function mapStockItem(row: StockItemsRow): InventoryItem {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    sku: row.item_code,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    quantity: row.quantity,
    unit: row.unit ?? undefined,
    minQuantity: row.min_threshold ?? undefined,
    location: row.location ?? undefined,
    barcode: row.barcode ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStockMovement(row: StockMovementsRow): StockTransaction {
  const typeMap = { add: 'in' as const, remove: 'out' as const, adjust: 'adjustment' as const, initial: 'in' as const };
  return {
    id: row.id,
    itemId: row.item_id,
    type: typeMap[row.action],
    quantity: row.quantity_change,
    reason: '',
    notes: row.notes ?? undefined,
    performedBy: row.user_id ?? '',
    timestamp: row.created_at,
  };
}

export const stockService = {
  // Get stock items (uses dedicated /api/stock/items)
  async getStockItems(filters?: { propertyId?: string; search?: string; category?: string }): Promise<ApiResponse<InventoryItem[]>> {
    try {
      const params = new URLSearchParams();
      if (filters?.propertyId) params.append('propertyId', filters.propertyId);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.category) params.append('category', filters.category);

      const res = await serverApi.get<any>(`/api/stock/items?${params.toString()}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stock items');
      return { success: true, data: (res.data?.items ?? []).map((row: any) => mapStockItem(row as StockItemsRow)) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock items';
      return { success: false, error: message, data: null as unknown as InventoryItem[] };
    }
  },

  // Get single stock item
  async getStockItem(id: string): Promise<ApiResponse<InventoryItem>> {
    try {
      const res = await serverApi.query<StockItemsRow>({
        table: 'stock_items',
        action: 'select',
        filters: [{ op: 'eq', column: 'id', value: id }],
        single: true,
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stock item');
      return { success: true, data: mapStockItem(res.data as StockItemsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock item';
      return { success: false, error: message, data: null as unknown as InventoryItem };
    }
  },

  // Create stock item (uses dedicated /api/stock/items)
  async createStockItem(data: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    try {
      const res = await serverApi.post<any>('/api/stock/items', {
        propertyId: data.propertyId,
        name: data.name,
        item_code: data.sku,
        description: data.description,
        category: data.category,
        quantity: data.quantity ?? 0,
        unit: data.unit,
        min_threshold: data.minQuantity ?? 10,
        location: data.location,
        barcode: data.barcode,
      });
      if (res.error) throw new Error(typeof res.error === 'string' ? res.error : res.error?.message ?? 'Failed to create stock item');
      return { success: true, data: mapStockItem(res.data?.item as StockItemsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create stock item';
      return { success: false, error: message, data: null as unknown as InventoryItem };
    }
  },

  // Update stock item
  async updateStockItem(id: string, data: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    try {
      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.sku !== undefined) payload.item_code = data.sku;
      if (data.description !== undefined) payload.description = data.description;
      if (data.category !== undefined) payload.category = data.category;
      if (data.quantity !== undefined) payload.quantity = data.quantity;
      if (data.unit !== undefined) payload.unit = data.unit;
      if (data.minQuantity !== undefined) payload.min_threshold = data.minQuantity;
      if (data.location !== undefined) payload.location = data.location;
      if (data.barcode !== undefined) payload.barcode = data.barcode;

      const res = await serverApi.query<StockItemsRow>({
        table: 'stock_items',
        action: 'update',
        values: payload,
        filters: [{ op: 'eq', column: 'id', value: id }],
        single: true,
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to update stock item');
      return { success: true, data: mapStockItem(res.data as StockItemsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update stock item';
      return { success: false, error: message, data: null as unknown as InventoryItem };
    }
  },

  // Delete stock item
  async deleteStockItem(id: string): Promise<ApiResponse<void>> {
    try {
      const res = await serverApi.query({
        table: 'stock_items',
        action: 'delete',
        filters: [{ op: 'eq', column: 'id', value: id }],
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to delete stock item');
      return { success: true, data: undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete stock item';
      return { success: false, error: message, data: null as unknown as void };
    }
  },

  // Get stock movements
  async getStockMovements(itemId: string): Promise<ApiResponse<StockTransaction[]>> {
    try {
      const res = await serverApi.query<StockMovementsRow[]>({
        table: 'stock_movements',
        action: 'select',
        filters: [{ op: 'eq', column: 'item_id', value: itemId }],
        orders: [{ column: 'created_at', ascending: false }],
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch stock movements');
      return { success: true, data: (res.data ?? []).map((row) => mapStockMovement(row)) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock movements';
      return { success: false, error: message, data: null as unknown as StockTransaction[] };
    }
  },

  // Add stock movement
  async addStockMovement(data: { itemId: string; type: 'intake' | 'outflow' | 'adjustment'; quantity: number; notes?: string }): Promise<ApiResponse<StockTransaction>> {
    try {
      const actionMap = { intake: 'add', outflow: 'remove', adjustment: 'adjust' };
      const res = await serverApi.query<StockMovementsRow>({
        table: 'stock_movements',
        action: 'insert',
        values: {
          item_id: data.itemId,
          action: actionMap[data.type],
          quantity_change: data.quantity,
          notes: data.notes ?? null,
        },
        single: true,
      });
      if (res.error) throw new Error(res.error?.message ?? 'Failed to add movement');

      // Adjust stock_items quantity
      const currentRes = await serverApi.query<{ quantity: number }>({
        table: 'stock_items',
        action: 'select',
        filters: [{ op: 'eq', column: 'id', value: data.itemId }],
        single: true,
      });
      const currentQty = currentRes.data?.quantity ?? 0;
      const newQuantity = data.type === 'adjustment' ? data.quantity : currentQty + (data.type === 'intake' ? data.quantity : -data.quantity);

      await serverApi.query({
        table: 'stock_items',
        action: 'update',
        values: { quantity: newQuantity },
        filters: [{ op: 'eq', column: 'id', value: data.itemId }],
      });

      return { success: true, data: mapStockMovement(res.data as StockMovementsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add stock movement';
      return { success: false, error: message, data: null as unknown as StockTransaction };
    }
  },

  // Get stock by barcode
  async getStockByBarcode(barcode: string, propertyId: string): Promise<ApiResponse<InventoryItem>> {
    try {
      const res = await serverApi.get<any>(`/api/stock/items/by-barcode?barcode=${encodeURIComponent(barcode)}&propertyId=${propertyId}`);
      if (res.error) throw new Error(res.error?.message ?? 'Failed to fetch by barcode');
      return { success: true, data: mapStockItem(res.data as StockItemsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock item by barcode';
      return { success: false, error: message, data: null as unknown as InventoryItem };
    }
  },
};
