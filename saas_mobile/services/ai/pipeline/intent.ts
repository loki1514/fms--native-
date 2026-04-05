/**
 * Intent Extraction — converts raw voice text to structured intent + entities.
 * Uses lightweight LLM call for parsing.
 */

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY, dangerouslyAllowBrowser: true });

export type Intent =
  | 'create_ticket'
  | 'check_ticket'
  | 'list_tickets'
  | 'get_property_info'
  | 'list_visitors'
  | 'list_rooms'
  | 'book_room'
  | 'cancel_booking'
  | 'greeting'
  | 'small_talk'
  | 'unknown';

export interface ExtractedIntent {
  intent: Intent;
  entities: Record<string, unknown>;
  confidence: number;
  reasoning: string;
}

const INTENT_EXTRACTION_PROMPT = `You are an intent classifier for a property management voice assistant.

Classify the user's voice message into ONE of these intents:
- create_ticket: user wants to report an issue or create a maintenance request
- check_ticket: user wants to know the status of a specific ticket
- list_tickets: user wants to see their tickets or a list of tickets
- get_property_info: user asks about property stats, open tickets count, etc.
- list_visitors: user asks about recent visitors
- list_rooms: user asks what meeting rooms are available
- book_room: user wants to book a meeting room (has time/date)
- cancel_booking: user wants to cancel a booking
- greeting: user says hello
- small_talk: casual conversation
- unknown: unclear intent

Extract entities:
- title (tickets): issue title
- description (tickets): issue description
- priority (tickets): low, medium, high, critical
- date: YYYY-MM-DD
- start_time: HH:MM
- end_time: HH:MM
- capacity: minimum room capacity
- ticket_id: ticket UUID
- status: open, resolved, closed

Respond ONLY as JSON:
{
  "intent": "...",
  "entities": { ... },
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Today is ${new Date().toISOString().split('T')[0]}.`;

export async function extractIntent(
  userText: string,
  history?: Array<{ role: string; content: string }>
): Promise<ExtractedIntent> {
  const fastResult = fastPathClassification(userText);
  if (fastResult.confidence > 0.9) return fastResult;

  try {
    const historyContext = history
      ? `\n\nRecent conversation:\n${history.slice(-4).map(h => `${h.role}: ${h.content}`).join('\n')}`
      : '';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: INTENT_EXTRACTION_PROMPT },
        { role: 'user', content: userText + historyContext },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(content);

    return {
      intent: normalizeIntent(parsed.intent),
      entities: parsed.entities ?? {},
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      reasoning: parsed.reasoning ?? '',
    };
  } catch (err) {
    console.error('[intent] LLM extraction failed, fallback:', err);
    return {
      intent: fastResult.intent,
      entities: fastResult.entities,
      confidence: fastResult.confidence * 0.5,
      reasoning: 'LLM extraction failed, used keyword fallback',
    };
  }
}

function fastPathClassification(text: string): ExtractedIntent {
  const lower = text.toLowerCase().trim();

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/.test(lower))
    return { intent: 'greeting', entities: {}, confidence: 1.0, reasoning: 'Direct greeting' };
  if (/how are you|what'?s up|how'?s it going/.test(lower))
    return { intent: 'small_talk', entities: {}, confidence: 1.0, reasoning: 'Casual conversation' };
  if (/book.*room|reserve.*room|meeting.*room|room.*booking/.test(lower))
    return { intent: 'book_room', entities: extractTimeEntities(text), confidence: 0.9, reasoning: 'Keyword match for room booking' };
  if (/create.*ticket|report|raise.*ticket|log.*issue|fix.*issue/.test(lower))
    return { intent: 'create_ticket', entities: extractTicketEntities(text), confidence: 0.9, reasoning: 'Keyword match for ticket creation' };
  if (/ticket.*status|status.*ticket|how.*ticket|my.*ticket/.test(lower))
    return { intent: 'check_ticket', entities: {}, confidence: 0.85, reasoning: 'Keyword match for ticket status' };
  if (/open.*ticket|my.*tickets|list.*tickets|all.*tickets/.test(lower))
    return { intent: 'list_tickets', entities: {}, confidence: 0.9, reasoning: 'Keyword match for ticket listing' };
  if (/meeting.*rooms?|available.*rooms?|list.*rooms?/.test(lower))
    return { intent: 'list_rooms', entities: {}, confidence: 0.9, reasoning: 'Keyword match for room listing' };
  if (/visitor|who.*visited|guest.*check.?in/.test(lower))
    return { intent: 'list_visitors', entities: {}, confidence: 0.9, reasoning: 'Keyword match for visitor list' };
  if (/property.*info|how many.*ticket|stats.*property/.test(lower))
    return { intent: 'get_property_info', entities: {}, confidence: 0.85, reasoning: 'Keyword match for property info' };

  return { intent: 'unknown', entities: {}, confidence: 0.0, reasoning: 'No pattern matched' };
}

function extractTimeEntities(text: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};
  const today = new Date();

  if (/tomorrow/i.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    entities.date = tomorrow.toISOString().split('T')[0];
  } else if (/today/i.test(text)) {
    entities.date = today.toISOString().split('T')[0];
  }

  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] ?? '0', 10);
    const period = timeMatch[3].toLowerCase();

    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    entities.start_time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    entities.end_time = `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return entities;
}

function extractTicketEntities(text: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  const priorityMatch = text.match(/urgent|critical|high priority|medium priority|low priority/i);
  if (priorityMatch) {
    const p = priorityMatch[0].toLowerCase();
    entities.priority = p.includes('critical') || p.includes('urgent') ? 'critical'
      : p.includes('high') ? 'high'
      : p.includes('medium') ? 'medium'
      : 'low';
  }

  const sentences = text.split(/[.,!?]/);
  if (sentences[0]) {
    entities.title = sentences[0].trim()
      .replace(/^(i want to |please |can you |could you |hey |hi )/i, '')
      .slice(0, 100);
  }

  entities.description = text;
  return entities;
}

function normalizeIntent(intent: string): Intent {
  const mapping: Record<string, Intent> = {
    'book_room': 'book_room', 'cancel_booking': 'cancel_booking',
    'check_ticket': 'check_ticket', 'create_ticket': 'create_ticket',
    'get_property_info': 'get_property_info', 'greeting': 'greeting',
    'list_rooms': 'list_rooms', 'list_tickets': 'list_tickets',
    'list_visitors': 'list_visitors', 'small_talk': 'small_talk',
    'unknown': 'unknown',
  };
  return mapping[intent.toLowerCase()] ?? 'unknown';
}
