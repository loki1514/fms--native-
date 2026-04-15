/**
 * /api/properties/[propertyId]/diesel-readings
 *
 * Handles diesel reading creation, deletion for the mobile logger.
 * Mirrors web app logic: auto-lookup of DG tariff, cost computation.
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

// ─── POST: Create / update diesel reading ───────────────────────────────────────

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
      generator_id,
      reading_date,
      opening_hours,
      closing_hours,
      opening_kwh,
      closing_kwh,
      opening_diesel_level,
      closing_diesel_level,
      diesel_added_litres,
      computed_consumed_litres,
      notes,
      alert_status,
    } = body;

    if (!generator_id || typeof generator_id !== 'string') {
      return jsonResponse({ error: 'Missing required field: generator_id' }, { status: 400 });
    }
    if (typeof closing_hours !== 'number') {
      return jsonResponse({ error: 'Missing required field: closing_hours' }, { status: 400 });
    }
    if (typeof closing_diesel_level !== 'number') {
      return jsonResponse({ error: 'Missing required field: closing_diesel_level' }, { status: 400 });
    }

    const effectiveDate = (reading_date as string) || new Date().toISOString().split('T')[0];
    const consumed = (computed_consumed_litres as number) ?? 0;

    // Auto-lookup active DG tariff
    let tariffRate = 0;
    let tariffId: string | null = null;

    const { data: tariffData } = await userClient.rpc('get_active_dg_tariff', {
      p_generator_id: generator_id,
      p_date: effectiveDate,
    });
    if (tariffData && tariffData.length > 0) {
      tariffId = tariffData[0].id;
      tariffRate = tariffData[0].cost_per_litre || 0;
    }

    // Compute cost
    const computedCost = consumed * tariffRate;

    // Upsert: check for existing reading on same date
    const { data: existing } = await userClient
      .from('diesel_readings')
      .select('id')
      .eq('generator_id', generator_id)
      .eq('reading_date', effectiveDate)
      .maybeSingle();

    let readingResult;

    if (existing) {
      const { data, error } = await userClient
        .from('diesel_readings')
        .update({
          opening_hours: opening_hours as number,
          closing_hours: closing_hours as number,
          opening_kwh: (opening_kwh as number) || 0,
          closing_kwh: (closing_kwh as number) || 0,
          opening_diesel_level: (opening_diesel_level as number) || 0,
          closing_diesel_level: closing_diesel_level as number,
          diesel_added_litres: (diesel_added_litres as number) || 0,
          computed_consumed_litres: consumed,
          notes: (notes as string) || null,
          alert_status: (alert_status as string) || 'normal',
          tariff_id: tariffId,
          tariff_rate_used: tariffRate,
          computed_cost: computedCost,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[diesel-readings] Update error:', error);
        return jsonResponse({ error: 'Failed to update reading', details: error.message }, { status: 500 });
      }
      readingResult = data;
    } else {
      const { data, error } = await userClient
        .from('diesel_readings')
        .insert({
          property_id: propertyId,
          generator_id,
          reading_date: effectiveDate,
          opening_hours: opening_hours as number,
          closing_hours: closing_hours as number,
          opening_kwh: (opening_kwh as number) || 0,
          closing_kwh: (closing_kwh as number) || 0,
          opening_diesel_level: (opening_diesel_level as number) || 0,
          closing_diesel_level: closing_diesel_level as number,
          diesel_added_litres: (diesel_added_litres as number) || 0,
          computed_consumed_litres: consumed,
          notes: (notes as string) || null,
          alert_status: (alert_status as string) || 'normal',
          created_by: userId,
          tariff_id: tariffId,
          tariff_rate_used: tariffRate,
          computed_cost: computedCost,
        })
        .select()
        .single();

      if (error) {
        console.error('[diesel-readings] Insert error:', error);
        return jsonResponse({ error: 'Failed to save reading', details: error.message }, { status: 500 });
      }
      readingResult = data;
    }

    // Update generator's carry-forward values
    await userClient
      .from('generators')
      .update({
        initial_run_hours: closing_hours as number,
        initial_diesel_level: closing_diesel_level as number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', generator_id);

    return jsonResponse({
      success: true,
      reading: readingResult,
      computed: { tariffRate, consumedLitres: consumed, computedCost },
    }, { status: 201 });

  } catch (err) {
    console.error('[diesel-readings] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Remove diesel reading ─────────────────────────────────────────────

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
      .from('diesel_readings')
      .select('generator_id')
      .eq('id', readingId)
      .eq('property_id', propertyId)
      .single();

    if (fetchError || !readingData) {
      return jsonResponse({ error: 'Reading not found' }, { status: 404 });
    }

    const { generator_id } = readingData;

    const { error: deleteError } = await userClient
      .from('diesel_readings')
      .delete()
      .eq('id', readingId)
      .eq('property_id', propertyId);

    if (deleteError) {
      console.error('[diesel-readings] Delete error:', deleteError);
      return jsonResponse({ error: 'Failed to delete reading', details: deleteError.message }, { status: 500 });
    }

    // Recalibrate generator's carry-forward values
    const { data: latestReadings } = await userClient
      .from('diesel_readings')
      .select('closing_hours, closing_diesel_level')
      .eq('generator_id', generator_id)
      .eq('property_id', propertyId)
      .order('reading_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1);

    if (latestReadings && latestReadings.length > 0) {
      await userClient
        .from('generators')
        .update({
          initial_run_hours: latestReadings[0].closing_hours,
          initial_diesel_level: latestReadings[0].closing_diesel_level,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generator_id);
    } else {
      await userClient
        .from('generators')
        .update({
          initial_run_hours: 0,
          initial_diesel_level: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', generator_id);
    }

    return jsonResponse({ success: true });

  } catch (err) {
    console.error('[diesel-readings] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
