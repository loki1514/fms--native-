/**
 * POST /api/voice/enroll
 *
 * Voice enrollment endpoint for ECAPA-TDNN speaker embedding.
 *
 * Flow:
 * 1. Authenticate via Bearer token (Supabase)
 * 2. Decode base64 audio (m4a / webm / wav)
 * 3. Convert audio to WAV PCM 16-bit 16kHz mono (FFmpeg, if available)
 * 4. Call the Cassandra ECAPA-TDNN server for a 192-dim embedding
 * 5. Store the embedding in Supabase `user_voice_embeddings`
 * 6. Return { embedding_id }
 *
 * If CASSANDRA_ECAPA_URL is not set or the server is unreachable,
 * a mock 192-dim embedding is generated so that local dev works without
 * the Cassandra service running.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClientFromToken, extractBearerToken } from '@/utils/supabase/mobile-auth';

// ---------------------------------------------------------------------------
// CORS headers — allow requests from any origin (mobile apps, web, localhost)
// ---------------------------------------------------------------------------
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: object, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...CORS_HEADERS,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EnrollRequest {
  audio: string;   // base64-encoded audio data
  format: string;  // mime type: audio/m4a | audio/webm | audio/wav | audio/mp4
}

// ---------------------------------------------------------------------------
// FFmpeg audio conversion — converts input audio to PCM 16-bit 16kHz mono WAV
// Returns the WAV buffer, or null if FFmpeg is unavailable.
// ---------------------------------------------------------------------------
async function convertAudioToWav(inputBuffer: Buffer, inputFormat: string): Promise<Buffer | null> {
  // FFmpeg is only available in Node.js server environments (not in Edge runtime).
  // Only attempt this import inside this async function so the module compiles
  // in both Edge and Node.js runtimes.
  try {
    const { execFile } = await import('child_process');
    const path = await import('path');
    const os = await import('os');
    const fs = await import('fs');

    return await new Promise<Buffer | null>((resolve) => {
      const tempInput = path.join(os.tmpdir(), `voice_enroll_input_${Date.now()}.tmp`);
      const tempOutput = path.join(os.tmpdir(), `voice_enroll_output_${Date.now()}.wav`);

      // Write input buffer to a temp file
      fs.writeFileSync(tempInput, inputBuffer);

      // Derive ffmpeg input args from mime type
      const formatMap: Record<string, string> = {
        'audio/m4a': 'm4a',
        'audio/mp4': 'mp4',
        'audio/webm': 'webm',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/mpeg': 'mp3',
      };
      const ffmpegFormat = formatMap[inputFormat] ?? 'wav';

      const args = [
        '-y',                          // overwrite output
        '-f', ffmpegFormat,             // input format
        '-i', tempInput,                // input file
        '-ar', '16000',                 // 16kHz sample rate
        '-ac', '1',                     // mono
        '-acodec', 'pcm_s16le',         // PCM 16-bit little-endian
        '-f', 'wav',                    // output format
        tempOutput,                     // output file
      ];

      execFile('ffmpeg', args, (error: Error | null, _stdout: string, stderr: string) => {
        // Always clean up input temp file
        try { fs.unlinkSync(tempInput); } catch {}
        if (error) {
          console.error('[voice/enroll] FFmpeg error:', stderr);
          try { fs.unlinkSync(tempOutput); } catch {}
          resolve(null);
          return;
        }

        try {
          const wavBuffer = fs.readFileSync(tempOutput);
          fs.unlinkSync(tempOutput);
          resolve(wavBuffer);
        } catch (readErr) {
          console.error('[voice/enroll] Failed to read converted WAV:', readErr);
          try { fs.unlinkSync(tempOutput); } catch {}
          resolve(null);
        }
      });
    });
  } catch (importErr) {
    console.warn('[voice/enroll] FFmpeg not available:', importErr);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mock 192-dim ECAPA embedding (development fallback)
// ---------------------------------------------------------------------------
function generateMockEmbedding(): number[] {
  // Generate a deterministic-ish random vector for consistent testing.
  // Real embeddings come from the ECAPA-TDNN model (serres17/ecapa_tdnn).
  const dims = 192;
  const vec = new Float32Array(dims);
  for (let i = 0; i < dims; i++) {
    // Values should be roughly in [-1, 1] for cosine-similarity search
    vec[i] = (Math.random() * 2) - 1;
  }
  return Array.from(vec);
}

// ---------------------------------------------------------------------------
// ECAPA server call — POSTs WAV audio, receives a 192-dim embedding vector
// ---------------------------------------------------------------------------
async function callEcapServer(wavBuffer: Buffer): Promise<number[] | null> {
  const ecapaUrl = process.env.CASSANDRA_ECAPA_URL;
  if (!ecapaUrl) {
    console.warn('[voice/enroll] CASSANDRA_ECAPA_URL not set — using mock embedding');
    return null;
  }

  try {
    const response = await fetch(ecapaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wavBuffer,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[voice/enroll] ECAPA server error ${response.status}: ${body}`);
      return null;
    }

    const data = (await response.json()) as { embedding?: number[] };
    if (!data.embedding || !Array.isArray(data.embedding) || data.embedding.length !== 192) {
      console.error('[voice/enroll] ECAPA response missing valid 192-dim embedding:', data);
      return null;
    }

    return data.embedding as number[];
  } catch (err) {
    console.error('[voice/enroll] ECAPA server unreachable:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate — extract and verify Bearer token
    const authHeader = request.headers.get('Authorization');
    const accessToken = extractBearerToken(authHeader);
    if (!accessToken) {
      return jsonResponse({ error: 'Unauthorized: missing or malformed Authorization header' }, { status: 401 });
    }

    // 2. Parse request body
    let body: EnrollRequest;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { audio: audioBase64, format } = body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return jsonResponse({ error: 'Missing required field: audio (base64 string)' }, { status: 400 });
    }
    if (!format || typeof format !== 'string') {
      return jsonResponse({ error: 'Missing required field: format (mime type string)' }, { status: 400 });
    }

    // 3. Decode base64 audio
    let audioBuffer: Buffer;
    try {
      audioBuffer = Buffer.from(audioBase64, 'base64');
    } catch {
      return jsonResponse({ error: 'Invalid base64 audio data' }, { status: 400 });
    }

    if (audioBuffer.length === 0) {
      return jsonResponse({ error: 'Empty audio data' }, { status: 400 });
    }

    const maxSizeBytes = 25 * 1024 * 1024; // 25 MB
    if (audioBuffer.length > maxSizeBytes) {
      return jsonResponse({ error: `Audio too large: ${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB (max 25MB)` }, { status: 413 });
    }

    // 4. Authenticated client — verify the user exists and get their ID
    const userSupabase = createClientFromToken(accessToken);
    const { data: authUser, error: authError } = await userSupabase.auth.getUser();
    if (authError || !authUser) {
      return jsonResponse({ error: 'Unauthorized: invalid or expired token' }, { status: 401 });
    }
    const userId = authUser.id;

    // 5. Get organization_id from org_memberships (optional, for org-level enrollment)
    const adminClient = createAdminClient();
    const { data: orgMembership } = await adminClient
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    const organizationId: string | null = orgMembership?.organization_id ?? null;

    // 6. Convert audio to WAV PCM 16-bit 16kHz mono
    //    FFmpeg is attempted first. If unavailable, the raw buffer is sent as-is
    //    (the ECAPA server may handle conversion internally).
    let wavBuffer = await convertAudioToWav(audioBuffer, format);
    if (!wavBuffer) {
      // Fallback: send raw buffer. The ECAPA server may accept raw PCM or WAV.
      console.warn('[voice/enroll] FFmpeg conversion failed — sending raw buffer to ECAPA server');
      wavBuffer = audioBuffer;
    }

    // 7. Get embedding from ECAPA server (or mock in dev)
    let embedding = await callEcapServer(wavBuffer);
    let isMock = false;

    if (!embedding) {
      console.warn('[voice/enroll] Using mock 192-dim embedding (ECAPA server unavailable)');
      embedding = generateMockEmbedding();
      isMock = true;
    }

    // Validate embedding dimensions
    if (!embedding || embedding.length !== 192) {
      console.error('[voice/enroll] Embedding dimension mismatch:', embedding?.length);
      return jsonResponse({ error: 'Speaker embedding generation failed: invalid dimensions' }, { status: 502 });
    }

    // 8. Store embedding in Supabase
    //    Uses the admin client to bypass RLS so the record can always be inserted.
    //    The embedding vector is stored as a JSONB array (pgvector can also be used
    //    with the `vector` type if the extension is installed).
    const { data: inserted, error: insertError } = await adminClient
      .from('user_voice_embeddings')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        embedding: embedding,
        status: 'enrolled',
        enrolled_at: new Date().toISOString(),
        confidence_score: isMock ? null : 0.95,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[voice/enroll] Failed to store embedding:', insertError);
      return jsonResponse(
        { error: 'Failed to store voice embedding. Please try again.' },
        { status: 500 }
      );
    }

    if (!inserted?.id) {
      console.error('[voice/enroll] Insert succeeded but no ID returned:', inserted);
      return jsonResponse({ error: 'Failed to retrieve embedding ID after storage' }, { status: 500 });
    }

    return jsonResponse({
      embedding_id: inserted.id,
      is_mock: isMock,
      dimensions: 192,
      enrolled_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[voice/enroll] Unexpected error:', err);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// OPTIONS — CORS preflight
// ---------------------------------------------------------------------------
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
