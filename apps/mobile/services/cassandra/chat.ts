// services/cassandra/chat.ts
//
// OpenAI-compatible SSE streaming client for Cassandra backend.
//
// Server sends:
//   data: <plain text token>\n\n    (one word at a time)
//   data: [DONE]\n\n                (stream terminator)
//
// This generator yields each token as a plain string.
// Caller accumulates into a message buffer.

import { supabase } from "@/utils/supabase";

const BASE_URL = process.env.EXPO_PUBLIC_CASSANDRA_API_URL;

export interface ChatStreamMeta {
  confidence?: number;
  sources?: string[];
  blocked?: boolean;
  requestId?: string;
}

export interface StreamChatOptions {
  photoUrl?: string;
  propertyId?: string | null;
  sessionId?: string;
  organizationId?: string;
  signal?: AbortSignal;
  onMeta?: (meta: ChatStreamMeta) => void;  // called when headers are parsed
  onThinking?: (text: string) => void;      // called when backend emits [THINKING]...
}

/**
 * Stream a chat message from Cassandra — OpenAI-style async generator.
 *
 * Usage:
 *   for await (const token of streamChat("show open tickets", opts)) {
 *     setMessage(prev => prev + token);
 *   }
 *
 * Yields plain text tokens one word at a time.
 * The generator completes when [DONE] is received or the stream closes.
 */
export async function* streamChat(
  message: string,
  options: StreamChatOptions = {}
): AsyncGenerator<string> {
  const { photoUrl, propertyId, sessionId, organizationId, signal, onMeta, onThinking } = options;

  // ── Auth ──────────────────────────────────────────────────────────────────
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    yield "⚠️ Please sign in again.";
    return;
  }

  // ── Build payload ─────────────────────────────────────────────────────────
  // session_id is REQUIRED per backend spec (ties multi-turn memory together).
  // If the caller forgot to generate one, we create a fallback so the backend
  // always receives a thread identifier.
  const effectiveSessionId = sessionId || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const body: Record<string, unknown> = {
    message,
    session_id: effectiveSessionId,
    ...(photoUrl  && { photo_url: photoUrl }),
    // Send null explicitly to tell backend "query across all properties"
    // Omit entirely to let backend fall back to JWT property_id
    ...(propertyId !== undefined && { property_id: propertyId }),
    ...(organizationId && { organization_id: organizationId }),
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
    if ((err as Error)?.name === "AbortError") return;
    yield "⚠️ Cannot reach Cassandra. Check your connection.";
    return;
  }

  if (!response.ok) {
    yield `⚠️ Server error (${response.status}). Please try again.`;
    return;
  }

  // ── Parse metadata from response headers ─────────────────────────────────
  if (onMeta) {
    const meta: ChatStreamMeta = {
      confidence: parseFloat(response.headers.get("X-Cassandra-Confidence") ?? "0") || undefined,
      sources:    response.headers.get("X-Cassandra-Sources")?.split(",").filter(Boolean),
      blocked:    response.headers.get("X-Cassandra-Blocked") === "true",
      requestId:  response.headers.get("X-Request-ID") ?? undefined,
    };
    onMeta(meta);
  }

  // ── Stream tokens ─────────────────────────────────────────────────────────
  const reader = response.body?.getReader();
  if (!reader) {
    yield "⚠️ Stream unavailable.";
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process all complete SSE events in the buffer
      const events = buffer.split("\n\n");
      // Keep the last (possibly incomplete) chunk in the buffer
      buffer = events.pop() ?? "";

      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith("data: ")) continue;

        const data = line.slice(6); // strip "data: "

        // OpenAI-style terminator — stop immediately
        if (data === "[DONE]") return;

        // Backend thinking states — surfaced in UI so user knows Cassandra
        // is working (e.g. "Looking up your tickets…").
        if (data.startsWith("[THINKING]")) {
          onThinking?.(data.replace("[THINKING]", "").trim());
          continue;
        }

        // Yield the plain text token to the caller
        if (data) yield data;
      }
    }
  } catch (err: unknown) {
    if ((err as Error)?.name !== "AbortError") {
      yield "\n⚠️ Stream interrupted.";
    }
  } finally {
    reader.cancel();
  }
}
