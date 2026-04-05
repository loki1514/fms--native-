/**
 * Response Generator — converts tool results into natural-language voice response.
 */

import OpenAI from 'openai';
import { ExtractedIntent } from './intent';
import { Plan, StepResult } from './planner';
import { VoiceContext } from './types';

const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY });

export interface ResponseResult {
  response: string;
  status: 'success' | 'error' | 'partial' | 'clarification';
}

function formatTicketsResult(steps: StepResult[]): string {
  const tickets = steps.find(s => s.step === 'list_tickets' || s.step === 'get_ticket_status');
  if (!tickets?.data || !Array.isArray(tickets.data)) {
    return "I couldn't find any tickets matching that request.";
  }

  const data = tickets.data as Array<{ ticket_number: string; title: string; status: string }>;
  if (data.length === 0) return "You don't have any tickets matching that request.";

  const summaries = data.slice(0, 5).map(t => `${t.ticket_number}: ${t.title} (${t.status})`);
  if (summaries.length === 1) return `Your ticket is: ${summaries[0]}`;
  return `Here are your tickets:\n${summaries.join('\n')}`;
}

function formatPropertyInfo(steps: StepResult[]): string {
  const propInfo = steps.find(s => s.step === 'get_property_info');
  if (!propInfo?.data) return "I couldn't get the property information right now.";

  const d = propInfo.data as { name?: string; openTicketCount?: number; totalTicketCount?: number };
  const open = d.openTicketCount ?? 0;
  const total = d.totalTicketCount ?? 0;

  if (open === 0) return `All clear at ${d.name}! No open maintenance tickets.`;
  return `${d.name ?? 'This property'} has ${open} open ticket${open !== 1 ? 's' : ''} out of ${total} total.`;
}

function formatRoomResult(steps: StepResult[]): string {
  const rooms = steps.find(s => s.step === 'list_meeting_rooms' || s.step === 'list_rooms');
  if (!rooms?.data || !Array.isArray(rooms.data)) return "I couldn't find any meeting rooms available.";

  const data = rooms.data as Array<{ name: string; capacity: number; floor?: string }>;
  if (data.length === 0) return 'No meeting rooms are available matching your criteria.';

  const roomList = data.slice(0, 5).map(r => `${r.name} (capacity ${r.capacity}${r.floor ? `, floor ${r.floor}` : ''})`);
  if (roomList.length === 1) return `Available room: ${roomList[0]}`;
  return `Here are the available meeting rooms:\n${roomList.join('\n')}`;
}

function formatCreateTicketResult(steps: StepResult[]): string {
  const ticket = steps.find(s => s.step === 'create_ticket');
  if (!ticket?.data) return "I couldn't create the ticket. Please try again.";

  const d = ticket.data as { ticket_number: string };
  return `Done! Your ticket has been created. Ticket number: ${d.ticket_number}. An engineer will look into it soon.`;
}

function formatBookRoomResult(steps: StepResult[]): string {
  const booking = steps.find(s => s.step === 'book_meeting_room');
  if (!booking?.success) return `I couldn't book the room. ${booking?.error ?? 'Please try again.'}`;

  const d = booking.data as { booking_date?: string; start_time?: string; end_time?: string };
  return `Your meeting room has been booked for ${d.booking_date} from ${d.start_time} to ${d.end_time}. Enjoy your meeting!`;
}

function formatVisitorResult(steps: StepResult[]): string {
  const visitors = steps.find(s => s.step === 'list_visitors');
  if (!visitors?.data || !Array.isArray(visitors.data)) return "I couldn't get the visitor list right now.";

  const data = visitors.data as Array<{ name: string; check_in_time?: string; host_name?: string }>;
  if (data.length === 0) return 'No visitor check-ins recorded recently.';

  const summaries = data.slice(0, 3).map(v =>
    `${v.name}${v.host_name ? ` (hosted by ${v.host_name})` : ''}`
  );
  return `Recent visitors:\n${summaries.join('\n')}`;
}

export async function generateResponse(
  transcript: string,
  intent: ExtractedIntent,
  plan: Plan,
  steps: StepResult[],
  toolResults: Record<string, unknown>,
  context: string,
  ctx: VoiceContext
): Promise<ResponseResult> {
  if (intent.intent === 'greeting') {
    return { response: `Hello ${ctx.userName}! I'm Autopilot, your property assistant. How can I help you today?`, status: 'success' };
  }

  if (intent.intent === 'small_talk') {
    return { response: "I'm doing great, thanks for asking! I'm here to help you manage your property. What can I do for you?", status: 'success' };
  }

  if (intent.intent === 'unknown' || plan.steps[0]?.step === 'clarify_intent') {
    return { response: "I'm not sure I understood that. Could you rephrase? For example, you can say 'list my tickets' or 'book a meeting room for 3pm tomorrow'.", status: 'clarification' };
  }

  const failedRequired = steps.filter(s => !s.success && plan.steps.find(p => p.step === s.step)?.required);
  if (failedRequired.length > 0) {
    return { response: `I ran into an issue: ${failedRequired[0].error}. Please try again or rephrase your request.`, status: 'partial' };
  }

  let responseText: string;

  switch (intent.intent) {
    case 'create_ticket':
      responseText = formatCreateTicketResult(steps);
      break;
    case 'check_ticket':
    case 'list_tickets':
      responseText = formatTicketsResult(steps);
      break;
    case 'get_property_info':
      responseText = formatPropertyInfo(steps);
      break;
    case 'list_rooms':
    case 'book_room':
      responseText = formatRoomResult(steps);
      if (steps.find(s => s.step === 'book_meeting_room')?.success) {
        responseText = formatBookRoomResult(steps);
      }
      break;
    case 'list_visitors':
      responseText = formatVisitorResult(steps);
      break;
    default:
      responseText = await generateLLMResponse(transcript, steps, context);
  }

  return { response: responseText, status: 'success' };
}

async function generateLLMResponse(
  transcript: string,
  steps: StepResult[],
  context: string
): Promise<string> {
  const resultsSummary = steps
    .filter(s => s.success && s.data)
    .map(s => `${s.step}: ${JSON.stringify(s.data)}`)
    .join('\n');

  const prompt = `You are Autopilot, a friendly voice assistant for a property management app. A user said: "${transcript}"

Tool results:
${resultsSummary}

${context}

Respond as a single short sentence (1-2 sentences max). Be friendly and conversational.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.7,
    });
    return completion.choices[0].message.content ?? "I've processed your request.";
  } catch {
    return "I've processed your request. Is there anything else I can help you with?";
  }
}
