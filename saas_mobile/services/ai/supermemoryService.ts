/**
 * Supermemory Service — Mobile (React Native)
 *
 * Direct REST API calls to Supermemory.
 * Lives client-side for lowest latency — no backend hop needed.
 *
 * API base: https://api.supermemory.ai
 * Auth: Bearer token via EXPO_PUBLIC_SUPERMEMORY_API_KEY
 */

const SUPERMEMORY_BASE = 'https://api.supermemory.ai';
const API_KEY = process.env.EXPO_PUBLIC_SUPERMEMORY_API_KEY ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type MemoryType = 'episodic' | 'semantic' | 'procedural';

export interface RetrievedMemory {
  content: string;
  type: MemoryType;
  score: number;
  lastUsed: string;
  source: string;
}

export interface MemoryContext {
  episodic: RetrievedMemory[];
  semantic: RetrievedMemory[];
  procedural: RetrievedMemory[];
}

// ---------------------------------------------------------------------------
// Container helpers (must match backend/memory.ts)
// ---------------------------------------------------------------------------
export function userContainer(userId: string) { return `user_${userId}`; }
export function orgContainer(orgId: string) { return `org_${orgId}`; }
export function propContainer(propId: string) { return `prop_${propId}`; }
export function sessionContainer(sessionId: string) { return `sess_${sessionId}`; }

// ---------------------------------------------------------------------------
// REST API helpers
// ---------------------------------------------------------------------------
async function smFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPERMEMORY_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Supermemory API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Search memories
// ---------------------------------------------------------------------------
interface SearchResult {
  similarity: number;
  updatedAt: string;
  chunk: string;
  metadata: Record<string, string | number | boolean | string[]>;
}

interface SearchResponse {
  results: SearchResult[];
  timing?: { total_ms: number };
  total?: number;
}

async function searchContainer(
  containerTag: string,
  query: string,
  threshold = 0.3,
  limit = 5
): Promise<RetrievedMemory[]> {
  if (!API_KEY) return [];

  try {
    const data = await smFetch<SearchResponse>('/memories/search', {
      q: query,
      containerTag,
      searchMode: 'memories',
      threshold,
      limit,
    });

    return (data.results ?? []).map((r) => ({
      content: r.chunk ?? String(r.metadata?.memoryContent ?? ''),
      type: ((r.metadata?.memoryType as MemoryType) ?? 'episodic') as MemoryType,
      score: r.similarity,
      lastUsed: r.updatedAt,
      source: String(r.metadata?.source ?? 'conversation'),
    }));
  } catch (err) {
    console.warn('[supermemory] Search failed for', containerTag, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Store a memory
// ---------------------------------------------------------------------------
async function storeToContainer(
  containerTag: string,
  content: string,
  memoryType: MemoryType,
  source: string,
  extraMeta?: Record<string, string | number | boolean>
): Promise<void> {
  if (!API_KEY) return;

  try {
    await smFetch('/memories/update', {
      containerTag,
      newContent: content,
      metadata: {
        memoryType,
        source,
        confidence: 0.8,
        ...extraMeta,
      },
    });
  } catch (err) {
    console.warn('[supermemory] Store failed for', containerTag, err);
  }
}

// ---------------------------------------------------------------------------
// Retrieve memories — fetches from all containers in parallel
// ---------------------------------------------------------------------------
const COMPANY_CONTAINER = 'company_autopilot';

export interface MemoryRetrieveInput {
  userId: string;
  organizationId: string;
  propertyId: string;
  sessionId: string;
  query: string;
}

export async function retrieveMemories(input: MemoryRetrieveInput): Promise<MemoryContext> {
  if (!API_KEY) return emptyContext();

  const containers = [
    COMPANY_CONTAINER,
    orgContainer(input.organizationId),
    userContainer(input.userId),
    propContainer(input.propertyId),
    sessionContainer(input.sessionId),
  ];

  const results = await Promise.allSettled(
    containers.map((tag) => searchContainer(tag, input.query))
  );

  const all: RetrievedMemory[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      all.push(...r.value);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped = all.filter((m) => {
    const key = m.content.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    episodic:   deduped.filter((m) => m.type === 'episodic'),
    semantic:   deduped.filter((m) => m.type === 'semantic'),
    procedural: deduped.filter((m) => m.type === 'procedural'),
  };
}

// ---------------------------------------------------------------------------
// Store memories after a voice interaction
// ---------------------------------------------------------------------------
export interface MemoryStoreInput {
  userId: string;
  organizationId: string;
  propertyId: string;
  sessionId: string;
  transcript: string;
  response: string;
  intent: string;
}

export async function storeMemories(input: MemoryStoreInput): Promise<void> {
  if (!API_KEY) return;

  const now = new Date().toISOString();
  const containers = [
    COMPANY_CONTAINER,
    orgContainer(input.organizationId),
    userContainer(input.userId),
    propContainer(input.propertyId),
    sessionContainer(input.sessionId),
  ];

  const entries = [
    // Episodic: this turn
    { content: `User asked: "${input.transcript.slice(0, 200)}"`, type: 'episodic' as MemoryType, source: 'conversation' },
    { content: `Agent responded: "${input.response.slice(0, 200)}"`, type: 'episodic' as MemoryType, source: 'tool_result' },
  ];

  // Semantic: extract basic facts
  const combined = `${input.transcript} ${input.response}`.toLowerCase();
  if (/morning|afternoon|evening|am|pm|9am|10am|3pm/i.test(combined)) {
    const match = combined.match(/(?:prefers?|usually|always|at|in the)\s+([^.!?\n]{5,40})/i);
    if (match) {
      entries.push({ content: `User time preference: "${match[1].trim()}"`, type: 'semantic' as MemoryType, source: 'conversation' });
    }
  }
  if (/urgent|critical|emergency|asap/i.test(combined) && input.intent === 'create_ticket') {
    entries.push({ content: 'User reported issue with urgency', type: 'semantic' as MemoryType, source: 'conversation' });
  }
  if (/again|still|persistent|recurring|keep happening|same issue/i.test(combined)) {
    entries.push({ content: `User reported recurring issue: "${input.transcript.slice(0, 100)}"`, type: 'semantic' as MemoryType, source: 'conversation' });
  }

  await Promise.allSettled(
    containers.flatMap((tag) =>
      entries.map((e) =>
        storeToContainer(tag, e.content, e.type, e.source, {
          intent: input.intent,
          turnTimestamp: now,
        })
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Format for LLM context string
// ---------------------------------------------------------------------------
export function formatMemoryContext(memories: MemoryContext, maxLen = 600): string {
  const sections: string[] = [];

  if (memories.semantic.length > 0) {
    sections.push(
      `## Learned Preferences\n` +
      memories.semantic
        .map((m) => `  [${m.source}] ${m.content}`)
        .join('\n')
    );
  }

  if (memories.episodic.length > 0) {
    sections.push(
      `## Recent Interaction Context\n` +
      memories.episodic
        .slice(0, 3)
        .map((m) => `  [${m.source}] ${m.content}`)
        .join('\n')
    );
  }

  if (memories.procedural.length > 0) {
    sections.push(
      `## Interaction Patterns\n` +
      memories.procedural
        .map((m) => `  [${m.source}] ${m.content}`)
        .join('\n')
    );
  }

  if (sections.length === 0) return '';

  let result = sections.join('\n\n');
  if (result.length > maxLen) {
    result = result.slice(0, maxLen) + '\n...(memory context truncated)';
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function emptyContext(): MemoryContext {
  return { episodic: [], semantic: [], procedural: [] };
}
