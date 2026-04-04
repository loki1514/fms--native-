import { supabase } from '@/utils/supabase';
import { ApiResponse } from './api/client';
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
  min_quantity: number | null;
  max_quantity: number | null;
  location: string | null;
  barcode: string | null;
  qr_code_data: string | null;
  cost_per_unit: number | null;
  created_at: string;
  updated_at: string;
}

interface StockMovementsRow {
  id: string;
  item_id: string;
  type: 'intake' | 'outflow' | 'adjustment';
  quantity: number;
  notes: string | null;
  performed_by: string | null;
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
    minQuantity: row.min_quantity ?? undefined,
    maxQuantity: row.max_quantity ?? undefined,
    location: row.location ?? undefined,
    barcode: row.barcode ?? undefined,
    qrCodeData: row.qr_code_data ?? undefined,
    costPerUnit: row.cost_per_unit ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStockMovement(row: StockMovementsRow): StockTransaction {
  const typeMap = {
    intake: 'in' as const,
    outflow: 'out' as const,
    adjustment: 'adjustment' as const,
  };
  return {
    id: row.id,
    itemId: row.item_id,
    type: typeMap[row.type],
    quantity: row.quantity,
    reason: '',
    notes: row.notes ?? undefined,
    performedBy: row.performed_by ?? '',
    timestamp: row.created_at,
  };
}

export const stockService = {
  async getStockItems(
    filters?: { propertyId?: string; search?: string; category?: string }
  ): Promise<ApiResponse<InventoryItem[]>> {
    try {
      let query = (supabase.from('stock_items').select('*') as any);

      if (filters?.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }

      if (filters?.search) {
        const term = `%${filters.search}%`;
        query = query.or(
          `name.ilike.${term},item_code.ilike.${term},barcode.ilike.${term}`
        );
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = (await query.order('created_at', { ascending: false })) as { data: unknown; error: unknown };

      if (error) throw error;

      return { success: true, data: ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => mapStockItem(row as unknown as StockItemsRow)) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock items';
      return { success: false, error: message, data: null as unknown as InventoryItem[] };
    }
  },

  async getStockItem(id: string): Promise<ApiResponse<InventoryItem>> {
    try {
      const { data, error } = (await supabase
        .from('stock_items')
        .select('*')
        .eq('id', id)
        .single()) as { data: unknown; error: unknown };

      if (error) throw error;

      return { success: true, data: mapStockItem(data as unknown as StockItemsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock item';
      return { success: false, error: message, data: null as unknown as InventoryItem };
    }
  },

  async createStockItem(data: Partial<InventoryItem>): Promise<ApiResponse<InventoryItem>> {
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        quantity: data.quantity ?? 0,
      };

      if (data.propertyId !== undefined) payload.property_id = data.propertyId;
      if (data.sku !== undefined) payload.item_code = data.sku;
      if (data.description !== undefined) payload.description = data.description;
      if (data.category !== undefined) payload.category = data.category;
      if (data.unit !== undefined) payload.unit = data.unit;
      if (data.minQuantity !== undefined) payload.min_quantity = data.minQuantity;
      if (data.maxQuantity !== undefined) payload.max_quantity = data.maxQuantity;
      if (data.location !== undefined) payload.location = data.location;
      if (data.barcode !== undefined) payload.barcode = data.barcode;
      if (data.qrCodeData !== undefined) payload.qr_code_data = data.qrCodeData;
      if (data.costPerUnit !== undefined) payload.cost_per_unit = data.costPerUnit;

      const { data: row, error }: any = await (supabase as any)
        .from('stock_items')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: mapStockItem(row as unknown as StockItemsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create stock item';
      return { success: false, error: message, data: null as unknown as InventoryItem };
    }
  },

  async updateStockItem(
    id: string,
    data: Partial<InventoryItem>
  ): Promise<ApiResponse<InventoryItem>> {
    try {
      const payload: Record<string, unknown> = {};

      if (data.name !== undefined) payload.name = data.name;
      if (data.sku !== undefined) payload.item_code = data.sku;
      if (data.description !== undefined) payload.description = data.description;
      if (data.category !== undefined) payload.category = data.category;
      if (data.quantity !== undefined) payload.quantity = data.quantity;
      if (data.unit !== undefined) payload.unit = data.unit;
      if (data.minQuantity !== undefined) payload.min_quantity = data.minQuantity;
      if (data.maxQuantity !== undefined) payload.max_quantity = data.maxQuantity;
      if (data.location !== undefined) payload.location = data.location;
      if (data.barcode !== undefined) payload.barcode = data.barcode;
      if (data.qrCodeData !== undefined) payload.qr_code_data = data.qrCodeData;
      if (data.costPerUnit !== undefined) payload.cost_per_unit = data.costPerUnit;

      const { data: row, error }: any = await (supabase as any)
        .from('stock_items')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: mapStockItem(row as unknown as StockItemsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update stock item';
      return { success: false, error: message, data: null as unknown as InventoryItem };
    }
  },

  async deleteStockItem(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await (supabase.from('stock_items').delete() as any).eq('id', id);

      if (error) throw error;

      return { success: true, data: undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete stock item';
      return { success: false, error: message, data: null as unknown as void };
    }
  },

  async getStockMovements(itemId: string): Promise<ApiResponse<StockTransaction[]>> {
    try {
      const { data, error } = (await supabase
        .from('stock_movements')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })) as { data: unknown; error: unknown };

      if (error) throw error;

      return { success: true, data: ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => mapStockMovement(row as unknown as StockMovementsRow)) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock movements';
      return { success: false, error: message, data: null as unknown as StockTransaction[] };
    }
  },

  async addStockMovement(data: {
    itemId: string;
    type: 'intake' | 'outflow' | 'adjustment';
    quantity: number;
    notes?: string;
  }): Promise<ApiResponse<StockTransaction>> {
    try {
      const { data: movement, error: movementError }: any = await (supabase as any)
        .from('stock_movements')
        .insert({
          item_id: data.itemId,
          type: data.type,
          quantity: data.quantity,
          notes: data.notes ?? null,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      // Adjust stock_items quantity
      let quantityDelta = 0;
      if (data.type === 'intake') {
        quantityDelta = data.quantity;
      } else if (data.type === 'outflow') {
        quantityDelta = -data.quantity;
      } else {
        // adjustment: treat as direct replacement via update below
        quantityDelta = data.quantity;
      }

      // For adjustments, set quantity directly; otherwise apply delta
      const { data: current, error: fetchError } = (await supabase
        .from('stock_items')
        .select('quantity')
        .eq('id', data.itemId)
        .single()) as { data: { quantity: number } | null; error: unknown };

      if (fetchError) throw fetchError;

      const newQuantity =
        data.type === 'adjustment'
          ? data.quantity
          : (current?.quantity ?? 0) + quantityDelta;

      const { error: updateError } = await (supabase as any)
        .from('stock_items')
        .update({ quantity: newQuantity })
        .eq('id', data.itemId);

      if (updateError) throw updateError;

      return { success: true, data: mapStockMovement(movement as unknown as StockMovementsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add stock movement';
      return { success: false, error: message, data: null as unknown as StockTransaction };
    }
  },

  async getStockByBarcode(
    barcode: string,
    propertyId: string
  ): Promise<ApiResponse<InventoryItem>> {
    try {
      const { data, error } = (await supabase
        .from('stock_items')
        .select('*')
        .eq('barcode', barcode)
        .eq('property_id', propertyId)
        .single()) as { data: unknown; error: unknown };

      if (error) throw error;

      return { success: true, data: mapStockItem(data as unknown as StockItemsRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch stock item by barcode';
      return { success: false, error: message, data: null as unknown as InventoryItem };
    }
  },
};
