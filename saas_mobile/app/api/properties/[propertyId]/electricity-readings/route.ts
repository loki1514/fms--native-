/**
 * /api/properties/[propertyId]/electricity-readings
 *
 * Handles electricity reading creation, deletion for the mobile logger.
 * Mirrors web app logic: auto-lookup of tariff/multiplier, cost computation.
 */

import { createClientFromToken, extractBearerToken } from '@/utils/supabase/mobile-auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: object, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─── POST: Create / update electricity reading ──────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;

    const authHeader = request.headers.get('Authorization');
    const accessToken = extractBearerToken(authHeader);
    if (!accessToken) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createClientFromToken(accessToken);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
    }
    const userId = user.id;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      meter_id,
      reading_date,
      opening_reading,
      closing_reading,
      notes,
      alert_status,
    } = body as Record<string, unknown>;

    if (!meter_id || typeof meter_id !== 'string') {
      return jsonResponse({ error: 'Missing required field: meter_id' }, { status: 400 });
    }
    if (typeof closing_reading !== 'number') {
      return jsonResponse({ error: 'Missing required field: closing_reading' }, { status: 400 });
    }

    const effectiveDate = (reading_date as string) || new Date().toISOString().split('T')[0];
    const rawUnits = (closing_reading as number) - ((opening_reading as number) || 0);

    // Auto-lookup active multiplier
    let multiplierValue = 1;
    let multiplierId: string | null = null;

    const { data: multData } = await userClient.rpc('get_active_multiplier', {
      p_meter_id: meter_id,
      p_date: effectiveDate,
    });
    if (multData && multData.length > 0) {
      multiplierId = multData[0].id;
      multiplierValue = multData[0].multiplier_value || 1;
    }

    // Auto-lookup active grid tariff
    let tariffRate = 0;
    let tariffId: string | null = null;

    const { data: tariffData } = await userClient.rpc('get_active_grid_tariff', {
      p_property_id: propertyId,
      p_date: effectiveDate,
    });
    if (tariffData && tariffData.length > 0) {
      tariffId = tariffData[0].id;
      tariffRate = tariffData[0].rate_per_unit || 0;
    }

    // Compute
    const finalUnits = rawUnits * multiplierValue;
    const computedCost = finalUnits * tariffRate;

    // Upsert: check for existing reading on same date
    const { data: existing } = await userClient
      .from('electricity_readings')
      .select('id')
      .eq('meter_id', meter_id as string)
      .eq('reading_date', effectiveDate)
      .maybeSingle();

    let readingResult;

    if (existing) {
      const { data, error } = await userClient
        .from('electricity_readings')
        .update({
          opening_reading: (opening_reading as number) || 0,
          closing_reading: closing_reading as number,
          notes: (notes as string) || null,
          alert_status: (alert_status as string) || 'normal',
          multiplier_id: multiplierId,
          multiplier_value_used: multiplierValue,
          tariff_id: tariffId,
          tariff_rate_used: tariffRate,
          final_units: finalUnits,
          computed_cost: computedCost,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[electricity-readings] Update error:', error);
        return jsonResponse({ error: 'Failed to update reading', details: error.message }, { status: 500 });
      }
      readingResult = data;
    } else {
      const { data, error } = await userClient
        .from('electricity_readings')
        .insert({
          property_id: propertyId,
          meter_id: meter_id as string,
          reading_date: effectiveDate,
          opening_reading: (opening_reading as number) || 0,
          closing_reading: closing_reading as number,
          notes: (notes as string) || null,
          alert_status: (alert_status as string) || 'normal',
          created_by: userId,
          multiplier_id: multiplierId,
          multiplier_value_used: multiplierValue,
          tariff_id: tariffId,
          tariff_rate_used: tariffRate,
          final_units: finalUnits,
          computed_cost: computedCost,
        })
        .select()
        .single();

      if (error) {
        console.error('[electricity-readings] Insert error:', error);
        return jsonResponse({ error: 'Failed to save reading', details: error.message }, { status: 500 });
      }
      readingResult = data;
    }

    // Update meter's last_reading
    await userClient
      .from('electricity_meters')
      .update({ last_reading: closing_reading as number, updated_at: new Date().toISOString() })
      .eq('id', meter_id as string);

    return jsonResponse({
      success: true,
      reading: readingResult,
      computed: { multiplier: multiplierValue, tariffRate, finalUnits, computedCost },
    }, { status: 201 });

  } catch (err) {
    console.error('[electricity-readings] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Remove electricity reading ───────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> }
): Promise<Response> {
  try {
    const { propertyId } = await params;

    const authHeader = request.headers.get('Authorization');
    const accessToken = extractBearerToken(authHeader);
    if (!accessToken) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const userClient = createClientFromToken(accessToken);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const readingId = searchParams.get('id');
    if (!readingId) {
      return jsonResponse({ error: 'Reading ID is required' }, { status: 400 });
    }

    const { data: readingData, error: fetchError } = await userClient
      .from('electricity_readings')
      .select('meter_id')
      .eq('id', readingId)
      .eq('property_id', propertyId)
      .single();

    if (fetchError || !readingData) {
      return jsonResponse({ error: 'Reading not found' }, { status: 404 });
    }

    const { meter_id } = readingData;

    const { error: deleteError } = await userClient
      .from('electricity_readings')
      .delete()
      .eq('id', readingId)
      .eq('property_id', propertyId);

    if (deleteError) {
      console.error('[electricity-readings] Delete error:', deleteError);
      return jsonResponse({ error: 'Failed to delete reading', details: deleteError.message }, { status: 500 });
    }

    // Recalibrate meter's last_reading
    const { data: latestReadings } = await userClient
      .from('electricity_readings')
      .select('closing_reading')
      .eq('meter_id', meter_id)
      .order('reading_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    const newLastReading = latestReadings && latestReadings.length > 0 ? latestReadings[0].closing_reading : 0;

    await userClient
      .from('electricity_meters')
      .update({ last_reading: newLastReading, updated_at: new Date().toISOString() })
      .eq('id', meter_id);

    return jsonResponse({ success: true });

  } catch (err) {
    console.error('[electricity-readings] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
