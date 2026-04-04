import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/client';

// ---------------------------------------------------------------------------
// OpenAI Client
// ---------------------------------------------------------------------------
const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '',
  dangerouslyAllowBrowser: true,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface VoiceContext {
  userId: string;
  propertyId: string;
  organizationId: string;
  userRole: string;
  userName: string;
  propertyName: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface PendingToolCall {
  name: string;
  args: string; // JSON string
  toolCallId: string;
}

// Return type for chatWithVoice
export interface ChatResponse {
  response: string;
  // If the LLM wants to call a tool, this is set.
  // The caller should execute the tool and call continueWithToolResult().
  pendingToolCall?: PendingToolCall;
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------
const VOICE_AGENT_PROMPT = `You are Autopilot, a friendly voice assistant for a property management mobile app. You are speaking to a tenant or super tenant.

RULES:
- Be concise and friendly. Keep responses to 1-3 sentences max.
- Always confirm actions before executing them.
- When a ticket is created, say the ticket number aloud.
- Never make up data. If you don't know something, say so clearly.
- The user is speaking to you by voice. Give short, conversational answers.

DATABASE SCHEMA:
- tickets(id, ticket_number, title, description, status, priority, created_at, raised_by, assigned_to)
- meeting_rooms(id, name, capacity, floor, credits_required, is_available)
- visitors(id, name, host_name, phone, check_in_time, check_out_time, purpose)
- users(id, full_name, email, role)
- properties(id, name, address)

AVAILABLE ACTIONS (use tools, don't guess):

1. create_ticket - Create a new maintenance ticket
   params: { title: string, description: string, priority?: "low" | "medium" | "high" | "critical" }

2. get_ticket_status - Get status of user's tickets
   params: { ticket_id?: string, status?: "open" | "resolved" | "closed" }

3. list_tickets - List recent tickets for the user's property
   params: { limit?: number, status?: string }

4. get_property_info - Get property overview stats
   params: {}

5. list_visitors - List recent visitor check-ins
   params: { limit?: number }

6. list_meeting_rooms - List available meeting rooms
   params: { date?: string, capacity?: number }

7. book_meeting_room - Book a meeting room
   params: { room_id: string, date: string, start_time: string, end_time: string }

Always use tools to get real data. Parse the user's intent and call the right tool.`;

// ---------------------------------------------------------------------------
// Tool Definitions (OpenAI function calling format)
// ---------------------------------------------------------------------------
const VOICE_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'create_ticket',
      description: 'Create a new maintenance ticket',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Ticket title/issue summary' },
          description: { type: 'string', description: 'Detailed description of the issue' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Priority level', default: 'medium' },
        },
        required: ['title', 'description'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_ticket_status',
      description: 'Get status of specific ticket or all tickets',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'Specific ticket ID (optional)' },
          status: { type: 'string', description: 'Filter by status (open/resolved/closed)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_tickets',
      description: 'List recent tickets',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max number to return', default: 10 },
          status: { type: 'string', description: 'Filter by status' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_property_info',
      description: 'Get property overview statistics',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_visitors',
      description: 'List recent visitor check-ins',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max to return', default: 5 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_meeting_rooms',
      description: 'List available meeting rooms',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
          capacity: { type: 'number', description: 'Minimum capacity' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'book_meeting_room',
      description: 'Book a meeting room',
      parameters: {
        type: 'object',
        properties: {
          room_id: { type: 'string', description: 'Room ID' },
          date: { type: 'string', description: 'Date YYYY-MM-DD' },
          start_time: { type: 'string', description: 'Start time HH:MM' },
          end_time: { type: 'string', description: 'End time HH:MM' },
        },
        required: ['room_id', 'date', 'start_time', 'end_time'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Executor — read-only tools only (Supabase direct)
// ---------------------------------------------------------------------------
export async function executeLocalTool(name: string, args: string): Promise<ToolResult> {
  const supabase = createClient();
  const params = JSON.parse(args);

  try {
    switch (name) {
      case 'get_ticket_status':
      case 'list_tickets': {
        let query = supabase
          .from('tickets')
          .select('id, ticket_number, title, status, priority, created_at')
          .eq('property_id', params.propertyId)
          .eq('internal', false)
          .order('created_at', { ascending: false });

        if (params.ticket_id) {
          query = query.eq('id', params.ticket_id).limit(1);
        } else if (params.status) {
          query = query.eq('status', params.status);
        }

        query = query.limit(params.limit ?? 10);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return { success: true, data };
      }

      case 'get_property_info': {
        const { data, error } = await supabase
          .from('properties')
          .select('name, address')
          .eq('id', params.propertyId)
          .single();
        if (error) throw new Error(error.message);

        const { count: openCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', params.propertyId)
          .eq('internal', false)
          .not('status', 'in', '(resolved,closed)');

        const { count: totalCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('property_id', params.propertyId)
          .eq('internal', false);

        return { success: true, data: { ...(data as Record<string, unknown>), openCount, totalCount } };
      }

      case 'list_visitors': {
        const { data, error } = await supabase
          .from('visitor_logs')
          .select('id, name, host_name, check_in_time, check_out_time, purpose')
          .eq('property_id', params.propertyId)
          .order('check_in_time', { ascending: false })
          .limit(params.limit ?? 5);
        if (error) throw new Error(error.message);
        return { success: true, data };
      }

      case 'list_meeting_rooms': {
        let query = supabase
          .from('meeting_rooms')
          .select('id, name, capacity, floor, credits_required')
          .eq('property_id', params.propertyId)
          .eq('is_available', true);

        if (params.capacity) {
          query = query.gte('capacity', params.capacity);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return { success: true, data };
      }

      case 'book_meeting_room': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('meeting_room_bookings') as any).insert({
          room_id: params.room_id,
          property_id: params.propertyId,
          user_id: params.userId,
          booking_date: params.date,
          start_time: params.start_time,
          end_time: params.end_time,
          status: 'confirmed',
        }).select().single();
        if (error) throw new Error(error.message);
        return { success: true, data };
      }

      default:
        return { success: false, error: `Unknown tool: ${name}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Speech-to-Text (Whisper)
// ---------------------------------------------------------------------------
export async function transcribeAudio(uri: string): Promise<string> {
  const formData = new FormData();

  let mimeType = 'audio/webm';
  if (uri.endsWith('.mp3') || uri.includes('mp3')) mimeType = 'audio/mp3';
  else if (uri.endsWith('.wav') || uri.includes('wav')) mimeType = 'audio/wav';
  else if (uri.endsWith('.m4a') || uri.includes('m4a')) mimeType = 'audio/mp4';

  formData.append('file', {
    uri,
    name: `recording.${mimeType.split('/')[1]}`,
    type: mimeType,
  } as unknown as Blob);

  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error: ${response.status} - ${err}`);
  }

  const result = await response.json();
  return result.text as string;
}

// ---------------------------------------------------------------------------
// Internal LLM call helper (reusable for initial + tool-result calls)
// ---------------------------------------------------------------------------
async function llmComplete(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  tools: OpenAI.Chat.ChatCompletionTool[],
  additionalMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
): Promise<{ message: OpenAI.Chat.ChatCompletionMessage; messages: OpenAI.Chat.ChatCompletionMessageParam[] }> {
  const allMessages = [...messages, ...additionalMessages];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: allMessages,
    tools,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 500,
  });

  return {
    message: completion.choices[0].message,
    messages: allMessages,
  };
}

// ---------------------------------------------------------------------------
// Chat with Tool Calling (two-phase)
// Phase 1: Returns pendingToolCall if LLM wants to run a tool.
// Phase 2 (via continueWithToolResult): Executes the tool and returns final response.
// ---------------------------------------------------------------------------
export async function chatWithVoice(
  userText: string,
  ctx: VoiceContext,
  history: Array<{ role: string; content: string }>
): Promise<ChatResponse> {
  const systemMsg: OpenAI.Chat.ChatCompletionSystemMessageParam = {
    role: 'system',
    content: VOICE_AGENT_PROMPT,
  };

  const contextMsg: OpenAI.Chat.ChatCompletionSystemMessageParam = {
    role: 'system',
    content: `\nCURRENT USER CONTEXT:\n- User: ${ctx.userName}\n- Role: ${ctx.userRole}\n- Property ID: ${ctx.propertyId}\n- Property: ${ctx.propertyName}\n- Organization: ${ctx.organizationId}`,
  };

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    systemMsg,
    contextMsg,
    ...history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: userText },
  ];

  const { message } = await llmComplete(messages, VOICE_TOOLS);

  // If the model wants to call a tool, return the pending tool call for the client to resolve
  const toolCall = message.tool_calls?.[0];
  if (toolCall) {
    const fn = (toolCall as unknown as { function: { name: string; arguments: string } }).function;
    return {
      response: message.content ?? '',
      pendingToolCall: {
        name: fn.name,
        args: fn.arguments,
        toolCallId: toolCall.id,
      },
    };
  }

  return { response: message.content ?? '' };
}

/**
 * Continue the conversation after a tool result is obtained.
 * Pass the pending tool call info + the result from executing it.
 *
 * @param pendingToolCall  - The tool call returned from chatWithVoice
 * @param toolResult       - The result from executing the tool
 * @param ctx              - Voice context
 * @param history          - Full conversation history (up to but not including the tool call message)
 * @param originalUserText - The original user text that triggered this turn
 */
export async function continueWithToolResult(
  pendingToolCall: PendingToolCall,
  toolResult: ToolResult,
  ctx: VoiceContext,
  history: Array<{ role: string; content: string }>,
  originalUserText: string
): Promise<string> {
  const systemMsg: OpenAI.Chat.ChatCompletionSystemMessageParam = {
    role: 'system',
    content: VOICE_AGENT_PROMPT,
  };

  const contextMsg: OpenAI.Chat.ChatCompletionSystemMessageParam = {
    role: 'system',
    content: `\nCURRENT USER CONTEXT:\n- User: ${ctx.userName}\n- Role: ${ctx.userRole}\n- Property ID: ${ctx.propertyId}\n- Property: ${ctx.propertyName}\n- Organization: ${ctx.organizationId}`,
  };

  const priorMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    systemMsg,
    contextMsg,
    ...history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: originalUserText },
  ];

  // Build the assistant message with the tool call (so the LLM sees it)
  const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: pendingToolCall.toolCallId,
        type: 'function',
        function: {
          name: pendingToolCall.name,
          arguments: pendingToolCall.args,
        },
      },
    ],
  };

  // Tool result message
  const toolResultMsg: OpenAI.Chat.ChatCompletionToolMessageParam = {
    role: 'tool',
    tool_call_id: pendingToolCall.toolCallId,
    content: JSON.stringify(toolResult),
  };

  const { message } = await llmComplete(
    priorMessages,
    VOICE_TOOLS,
    [assistantMsg, toolResultMsg]
  );

  return message.content ?? '';
}

// ---------------------------------------------------------------------------
// Text-to-Speech (tts-1)
// ---------------------------------------------------------------------------
export async function generateSpeech(text: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
      speed: 1.0,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`TTS API error: ${response.status} - ${err}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  return url;
}
